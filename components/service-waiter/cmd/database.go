// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"crypto/tls"
	"crypto/x509"
	"database/sql"
	"net"
	"os"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/gitpod-io/gitpod/common-go/log"
)

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
		cfg := mysql.NewConfig()
		cfg.Addr = net.JoinHostPort(viper.GetString("host"), viper.GetString("port"))
		cfg.Net = "tcp"
		cfg.User = viper.GetString("username")
		cfg.Passwd = viper.GetString("password")
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

		timeout := getTimeout()
		done := make(chan bool)
		go func() {
			log.WithField("timeout", timeout.String()).WithField("dsn", censoredDSN).Info("attempting to connect to DB")
			for {
				db, err := sql.Open("mysql", cfg.FormatDSN())
				if err != nil {
					continue
				}
				err = db.Ping()
				if err != nil {
					if strings.Contains(err.Error(), "Access denied") {
						fail("Invalid credentials for the database. Check DB_USERNAME and DB_PASSWORD.")
					}

					log.WithError(err).Debug("retry")
					<-time.After(time.Second)
					continue
				}

				err = db.Close()
				if err != nil {
					log.WithError(err).Warn("cannot close DB connection used for probing")
				}
				break
			}

			done <- true
		}()

		select {
		case <-done:
			log.Info("database became available")
			return
		case <-time.After(timeout):
			log.WithField("timeout", timeout.String()).Fatal("database did not become available in time")
		}
	},
}

func init() {
	rootCmd.AddCommand(databaseCmd)

	databaseCmd.Flags().StringP("host", "H", os.Getenv("DB_HOST"), "Host to try and connect to")
	databaseCmd.Flags().StringP("port", "p", envOrDefault("DB_PORT", "3306"), "Port to connect on")
	databaseCmd.Flags().StringP("password", "P", os.Getenv("DB_PASSWORD"), "Password to use when connecting")
	databaseCmd.Flags().StringP("username", "u", envOrDefault("DB_USERNAME", "gitpod"), "Username to use when connected")
	databaseCmd.Flags().StringP("caCert", "", os.Getenv("DB_CA_CERT"), "Custom CA cert (chain) to use when connected")
}
