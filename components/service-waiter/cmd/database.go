// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/gitpod-io/gitpod/common-go/log"
)

const migrationTableName = "migrations"

//go:embed resources/latest-migration.txt
var latestMigrationName string

// databaseCmd represents the database command
var databaseCmd = &cobra.Command{
	Use:   "database",
	Short: "waits for a MySQL database to become available",
	Long: `Uses the default db env config of a Gitpod deployment to try and
connect to a MySQL database, specifically DB_HOST, DB_PORT, DB_PASSWORD,
DB_CA_CERT and DB_USER(=gitpod)`,
	PreRun: func(cmd *cobra.Command, args []string) {
		err := viper.BindPFlags(cmd.Flags())
		if err != nil {
			log.WithError(err).Fatal("cannot bind Viper to pflags")
		}
	},
	Run: func(cmd *cobra.Command, args []string) {
		timeout := getTimeout()
		ctx, cancel := context.WithTimeout(cmd.Context(), timeout)
		defer cancel()

		cfg := mysql.NewConfig()
		cfg.Addr = net.JoinHostPort(viper.GetString("host"), viper.GetString("port"))
		cfg.Net = "tcp"
		cfg.User = viper.GetString("username")
		cfg.Passwd = viper.GetString("password")

		// Must be "gitpod"
		// Align to https://github.com/gitpod-io/gitpod/blob/884d922e8e33d8b936ec18d7fe3c8dcffde42b5a/components/gitpod-db/go/conn.go#L37
		cfg.DBName = "gitpod"
		cfg.Timeout = 1 * time.Second

		dsn := cfg.FormatDSN()
		censoredDSN := dsn
		if cfg.Passwd != "" {
			censoredDSN = strings.Replace(dsn, cfg.Passwd, "*****", -1)
		}

		caCert := viper.GetString("caCert")
		if caCert != "" {
			rootCertPool := x509.NewCertPool()
			if ok := rootCertPool.AppendCertsFromPEM([]byte(caCert)); !ok {
				fail("Failed to append DB CA cert.")
			}

			tlsConfigName := "custom"
			err := mysql.RegisterTLSConfig(tlsConfigName, &tls.Config{
				RootCAs:    rootCertPool,
				MinVersion: tls.VersionTLS12, // semgrep finding: set lower boundary to exclude insecure TLS1.0
			})
			if err != nil {
				fail(fmt.Sprintf("Failed to register DB CA cert: %+v", err))
			}
			cfg.TLSConfig = tlsConfigName
		}

		migrationName := GetLatestMigrationName()
		migrationCheck := viper.GetBool("migration-check")
		log.WithField("timeout", timeout.String()).WithField("dsn", censoredDSN).WithField("migration", migrationName).WithField("migrationCheck", migrationCheck).Info("waiting for database")
		var lastErr error
		log.Info("attempting to check if database is available")
		for ctx.Err() == nil {
			if err := checkDbAvailable(ctx, cfg, migrationName, migrationCheck); err != nil {
				if lastErr == nil || (lastErr != nil && err.Error() != lastErr.Error()) {
					// log if error is new or changed
					log.WithError(err).Error("database not available")
					log.Info("attempting to check if database is available")
				} else {
					log.WithError(err).Debug("database not available, attempting to check again")
				}
				lastErr = err
				<-time.After(time.Second)
			} else {
				break
			}
		}

		if ctx.Err() != nil {
			log.WithError(ctx.Err()).WithError(lastErr).Error("database did not become available in time")
			fail(fmt.Sprintf("database did not become available in time(%s): %+v", timeout.String(), lastErr))
		} else {
			log.Info("database became available")
		}
	},
}

func GetLatestMigrationName() string {
	return strings.TrimSpace(latestMigrationName)
}

// checkDbAvailable will connect and check if database is connectable
// with migrations and migrationCheck set, it will also check if the latest migration has been applied
func checkDbAvailable(ctx context.Context, cfg *mysql.Config, migration string, migrationCheck bool) (err error) {
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return err
	}
	// ignore error
	defer db.Close()

	// if migration name is not set, just ping the database
	if migration == "" || !migrationCheck {
		return db.PingContext(ctx)
	}

	row := db.QueryRowContext(ctx, "SELECT name FROM "+migrationTableName+" ORDER BY `timestamp` DESC LIMIT 1")
	var dbLatest string
	if err := row.Scan(&dbLatest); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("failed to check migrations: no row found")
		}
		return fmt.Errorf("failed to check migrations: %w", err)
	}
	if dbLatest != migration {
		return fmt.Errorf("expected migration %s, but found %s", migration, dbLatest)
	}
	log.WithField("want", migration).WithField("got", dbLatest).Info("migrated")

	return nil
}

func init() {
	rootCmd.AddCommand(databaseCmd)

	databaseCmd.Flags().StringP("host", "H", os.Getenv("DB_HOST"), "Host to try and connect to")
	databaseCmd.Flags().StringP("port", "p", envOrDefault("DB_PORT", "3306"), "Port to connect on")
	databaseCmd.Flags().StringP("password", "P", os.Getenv("DB_PASSWORD"), "Password to use when connecting")
	databaseCmd.Flags().StringP("username", "u", envOrDefault("DB_USERNAME", "gitpod"), "Username to use when connected")
	databaseCmd.Flags().StringP("caCert", "", os.Getenv("DB_CA_CERT"), "Custom CA cert (chain) to use when connected")

	databaseCmd.Flags().BoolP("migration-check", "", false, "Enable to check if the latest migration has been applied")
}
