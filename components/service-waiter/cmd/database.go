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
				log.Fatal("Failed to append DB CA cert.")
			}

			tlsConfigName := "custom"
			err := mysql.RegisterTLSConfig(tlsConfigName, &tls.Config{
				RootCAs:    rootCertPool,
				MinVersion: tls.VersionTLS12, // semgrep finding: set lower boundary to exclude insecure TLS1.0
			})
			if err != nil {
				log.WithError(err).Fatal("Failed to register DB CA cert")
			}
			cfg.TLSConfig = tlsConfigName
		}

		migrationName := GetLatestMigrationName()
		log.WithField("timeout", timeout.String()).WithField("dsn", censoredDSN).WithField("migration", migrationName).Info("waiting for database")
		for ctx.Err() == nil {
			log.Info("attempting to check if database is available")
			if err := checkDbAvailable(ctx, cfg, migrationName); err != nil {
				log.WithError(err).Debug("retry")
				<-time.After(time.Second)
			} else {
				break
			}
		}

		if ctx.Err() != nil {
			log.WithField("timeout", timeout.String()).WithError(ctx.Err()).Fatal("database did not become available in time")
		} else {
			log.Info("database became available")
		}
	},
}

func GetLatestMigrationName() string {
	return strings.TrimSpace(latestMigrationName)
}

// checkDbAvailable will connect and check if migrations table contains the latest migration
func checkDbAvailable(ctx context.Context, cfg *mysql.Config, migration string) error {
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return err
	}
	// ignore error
	defer db.Close()

	// if migration name is not set, just ping the database
	if migration == "" {
		return db.PingContext(ctx)
	}

	log.Info("checking if database is migrated")
	row := db.QueryRowContext(ctx, "SELECT name FROM "+migrationTableName+" WHERE name = ?", migration)
	var name string
	if err := row.Scan(&name); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			log.Error("not yet migrated")
			return err
		}
		log.WithError(err).Error("failed to query migrations")
		return err
	}

	return nil
}

func init() {
	rootCmd.AddCommand(databaseCmd)

	databaseCmd.Flags().StringP("host", "H", os.Getenv("DB_HOST"), "Host to try and connect to")
	databaseCmd.Flags().StringP("port", "p", envOrDefault("DB_PORT", "3306"), "Port to connect on")
	databaseCmd.Flags().StringP("password", "P", os.Getenv("DB_PASSWORD"), "Password to use when connecting")
	databaseCmd.Flags().StringP("username", "u", envOrDefault("DB_USERNAME", "gitpod"), "Username to use when connected")
	databaseCmd.Flags().StringP("caCert", "", os.Getenv("DB_CA_CERT"), "Custom CA cert (chain) to use when connected")
}
