// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	driver_mysql "github.com/go-sql-driver/mysql"
	"github.com/sirupsen/logrus"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/plugin/opentelemetry/tracing"
)

type ConnectionParams struct {
	User     string
	Password string
	Host     string
	Database string
	CaCert   string
}

func ConnectionParamsFromEnv() ConnectionParams {
	return ConnectionParams{
		User:     os.Getenv("DB_USERNAME"),
		Password: os.Getenv("DB_PASSWORD"),
		Host:     net.JoinHostPort(os.Getenv("DB_HOST"), os.Getenv("DB_PORT")),
		Database: "gitpod",
		CaCert:   os.Getenv("DB_CA_CERT"),
	}
}

func Connect(p ConnectionParams) (*gorm.DB, error) {
	loc, err := time.LoadLocation("UTC")
	if err != nil {
		return nil, fmt.Errorf("Failed to load UTC location: %w", err)
	}
	cfg := driver_mysql.Config{
		User:                 p.User,
		Passwd:               p.Password,
		Net:                  "tcp",
		Addr:                 p.Host,
		DBName:               p.Database,
		Loc:                  loc,
		AllowNativePasswords: true,
		ParseTime:            true,
	}

	if p.CaCert != "" {
		rootCertPool := x509.NewCertPool()
		if ok := rootCertPool.AppendCertsFromPEM([]byte(p.CaCert)); !ok {
			return nil, fmt.Errorf("failed to append custom certificate for database connection")
		}

		tlsConfigName := "custom"
		err = driver_mysql.RegisterTLSConfig(tlsConfigName, &tls.Config{
			RootCAs:    rootCertPool,
			MinVersion: tls.VersionTLS12, // semgrep finding: set lower boundary to exclude insecure TLS1.0
		})
		if err != nil {
			return nil, fmt.Errorf("failed to register custom DB CA cert: %w", err)
		}
		cfg.TLSConfig = tlsConfigName
	}

	// refer to https://github.com/go-sql-driver/mysql#dsn-data-source-name for details
	conn, err := gorm.Open(mysql.Open(cfg.FormatDSN()), &gorm.Config{
		Logger: logger.New(log.Log, logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			Colorful:                  false,
			IgnoreRecordNotFoundError: true,
			LogLevel: (func() logger.LogLevel {
				switch log.Log.Level {
				case logrus.PanicLevel, logrus.FatalLevel, logrus.ErrorLevel:
					return logger.Error
				case logrus.WarnLevel:
					return logger.Warn
				default:
					return logger.Info
				}
			})(),
		}),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open db connection: %w", err)
	}

	err = conn.Use(tracing.NewPlugin())
	if err != nil {
		return nil, fmt.Errorf("failed to setup db tracing: %w", err)
	}

	return conn, nil
}
