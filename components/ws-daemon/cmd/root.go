// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/daemon"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-daemon"
	// Version of this service - set during build
	Version = ""
)

var verbose bool
var configFile string
var jsonLog bool

var rootCmd = &cobra.Command{
	Use:   "ws-daemond",
	Short: "Workspace initialization and synchronization daemon",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, verbose)
	},
}

// Execute runs this main command
func Execute() {
	closer := tracing.Init("ws-daemon")
	if closer != nil {
		defer closer.Close()
	}

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func getConfig() *config {
	ctnt, err := os.ReadFile(configFile)
	if err != nil {
		log.WithError(err).Fatal("cannot read configuration. Maybe missing --config?")
	}

	var cfg config
	dec := json.NewDecoder(bytes.NewReader(ctnt))
	dec.DisallowUnknownFields()
	err = dec.Decode(&cfg)
	if err != nil {
		log.WithError(err).Fatal("cannot decode configuration. Maybe missing --config?")
	}

	return &cfg
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "j", true, "produce JSON log output on verbose level")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose JSON logging")
	rootCmd.PersistentFlags().StringVar(&configFile, "config", "", "config file")
}

type config struct {
	Daemon  daemon.Config `json:"daemon"`
	Service struct {
		Addr string    `json:"address"`
		TLS  tlsConfig `json:"tls"`
	} `json:"service"`
	Prometheus struct {
		Addr string `json:"address"`
	} `json:"prometheus"`
	PProf struct {
		Addr string `json:"address"`
	} `json:"pprof"`
}

type tlsConfig struct {
	Authority   string `json:"ca"`
	Certificate string `json:"crt"`
	PrivateKey  string `json:"key"`
}

// ServerOption produces the GRPC option that configures a server to use this TLS configuration
func (c *tlsConfig) ServerOption() (grpc.ServerOption, error) {
	if c.Authority == "" || c.Certificate == "" || c.PrivateKey == "" {
		return nil, nil
	}

	// Load certs
	certificate, err := tls.LoadX509KeyPair(c.Certificate, c.PrivateKey)
	if err != nil {
		return nil, xerrors.Errorf("cannot load TLS certificate: %w", err)
	}

	// Create a certificate pool from the certificate authority
	certPool := x509.NewCertPool()
	ca, err := os.ReadFile(c.Authority)
	if err != nil {
		return nil, xerrors.Errorf("cannot not read ca certificate: %w", err)
	}
	if ok := certPool.AppendCertsFromPEM(ca); !ok {
		return nil, xerrors.Errorf("failed to append ca certs")
	}

	creds := credentials.NewTLS(&tls.Config{
		ClientAuth:   tls.RequireAndVerifyClientCert,
		Certificates: []tls.Certificate{certificate},
		ClientCAs:    certPool,
		MinVersion:   tls.VersionTLS12,
	})

	return grpc.Creds(creds), nil
}
