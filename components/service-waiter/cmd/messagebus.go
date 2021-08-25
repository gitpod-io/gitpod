// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/streadway/amqp"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// messagebusCmd represents the messagebus command
var messagebusCmd = &cobra.Command{
	Use:   "messagebus",
	Short: "waits for the messagebus to become available",
	Long: `Connects to the messagebus via AMQP protocol using host, port, username and password.
Optionally, TLS can be used to create the connection.`,
	PreRun: func(cmd *cobra.Command, args []string) {
		err := viper.BindPFlags(cmd.Flags())
		if err != nil {
			log.WithError(err).Fatal("cannot bind Viper to pflags")
		}
	},
	Run: func(cmd *cobra.Command, args []string) {
		password := viper.GetString("password")
		dsn := fmt.Sprintf("amqp://%s:%s@%s:%s",
			viper.GetString("username"),
			password,
			viper.GetString("host"),
			viper.GetString("port"),
		)
		censoredDSN := dsn
		if password != "" {
			censoredDSN = strings.Replace(dsn, password, "*****", -1)
		}

		dialer := func() error {
			conn, err := amqp.Dial(dsn)
			if err == nil {
				conn.Close()
			}
			return err
		}

		tlsCA := viper.GetString("tls-ca")
		tlsCert := viper.GetString("tls-cert")
		tlsKey := viper.GetString("tls-key")
		if tlsCA != "" && tlsCert != "" && tlsKey != "" {
			log.Info("using TLS")

			var cfg tls.Config
			cfg.RootCAs = x509.NewCertPool()
			cfg.RootCAs.AppendCertsFromPEM([]byte(tlsCA))

			cert, err := tls.X509KeyPair([]byte(tlsCert), []byte(tlsKey))
			if err != nil {
				fail(fmt.Sprintf("cannot load TLS cert: %v", err))
				return
			}
			cfg.Certificates = append(cfg.Certificates, cert)

			dialer = func() error {
				conn, err := amqp.DialTLS(dsn, &cfg)
				if err == nil {
					conn.Close()
				}
				return err
			}
		}

		timeout := getTimeout()
		done := make(chan bool)
		go func() {
			log.WithField("timeout", timeout.String()).WithField("dsn", censoredDSN).Info("attempting to connect to messagebus")
			for {
				err := dialer()
				if err == nil {
					break
				}
				if err == amqp.ErrCredentials {
					fail("Invalid credentials for the messagebus. Check MESSAGEBUS_USERNAME and MESSAGEBUS_PASSWORD.")
				}

				<-time.After(time.Second)
				log.WithError(err).Debug("retry")
			}

			done <- true
		}()

		select {
		case <-done:
			log.Info("messagebus became available")
			return
		case <-time.After(timeout):
			log.WithField("timeout", timeout.String()).Fatal("messagebus did not become available in time")
		}
	},
}

func init() {
	rootCmd.AddCommand(messagebusCmd)

	messagebusCmd.Flags().StringP("host", "H", envOrDefault("MESSAGEBUS_HOST", "messagebus"), "Host to try and connect to")
	// we cannot use MESSAGEBUS_PORT as env var as Kubernetes sets this to tcp://ip:port which is not just the port number as we'd expect
	messagebusCmd.Flags().StringP("port", "p", "5672", "Port to connect on")
	messagebusCmd.Flags().StringP("password", "P", os.Getenv("MESSAGEBUS_PASSWORD"), "Password to use when connecting")
	messagebusCmd.Flags().StringP("username", "u", envOrDefault("MESSAGEBUS_USERNAME", "gitpod"), "Username to use when connected")
	messagebusCmd.Flags().String("tls-ca", os.Getenv("MESSAGEBUS_CA"), "certificate authority when using TLS")
	messagebusCmd.Flags().String("tls-cert", os.Getenv("MESSAGEBUS_CERT"), "certificate when using TLS")
	messagebusCmd.Flags().String("tls-key", os.Getenv("MESSAGEBUS_KEY"), "private key for the TLS certificate")
}
