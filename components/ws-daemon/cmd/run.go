// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"time"

	"google.golang.org/grpc/credentials/insecure"

	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/watch"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/config"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/daemon"
)

const grpcServerName = "wsdaemon"

// serveCmd represents the serve command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Connects to the messagebus and starts the workspace monitor",

	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Read(configFile)
		if err != nil {
			log.WithError(err).Fatal("Cannot read configuration. Maybe missing --config?")
		}

		createLVMDevices()

		health := healthcheck.NewHandler()
		srv, err := baseserver.New(grpcServerName,
			baseserver.WithGRPC(&cfg.Service),
			baseserver.WithHealthHandler(health),
			baseserver.WithVersion(Version),
		)
		if err != nil {
			log.WithError(err).Fatal("Cannot set up server.")
		}

		dmn, err := daemon.NewDaemon(cfg.Daemon, prometheus.WrapRegistererWithPrefix("gitpod_ws_daemon_", srv.MetricsRegistry()))
		if err != nil {
			log.WithError(err).Fatal("Cannot create daemon.")
		}

		health.AddReadinessCheck("grpc-server", grpcProbe(cfg.Service))
		health.AddReadinessCheck("ws-daemon", dmn.ReadinessProbe())

		dmn.Register(srv.GRPC())

		err = dmn.Start()
		if err != nil {
			log.WithError(err).Fatal("Cannot start daemon.")
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		err = watch.File(ctx, configFile, func() {
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()

			cfg, err := config.Read(configFile)
			if err != nil {
				log.WithError(err).Warn("Cannot reload configuration.")
				return
			}

			err = dmn.ReloadConfig(ctx, &cfg.Daemon)
			if err != nil {
				log.WithError(err).Warn("Cannot reload configuration.")
			}
		})
		if err != nil {
			log.WithError(err).Fatal("Cannot start watch of configuration file.")
		}

		err = syscall.Setpriority(syscall.PRIO_PROCESS, os.Getpid(), -19)
		if err != nil {
			log.WithError(err).Error("cannot change ws-daemon priority")
		}

		err = srv.ListenAndServe()
		if err != nil {
			log.WithError(err).Fatal("Failed to listen and serve.")
		}
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}

func grpcProbe(cfg baseserver.ServerConfiguration) func() error {
	return func() error {
		creds := insecure.NewCredentials()
		if cfg.TLS != nil && cfg.TLS.CertPath != "" {
			tlsConfig, err := common_grpc.ClientAuthTLSConfig(
				cfg.TLS.CAPath, cfg.TLS.CertPath, cfg.TLS.KeyPath,
				common_grpc.WithSetRootCAs(true),
				common_grpc.WithServerName(grpcServerName),
			)
			if err != nil {
				return fmt.Errorf("cannot load ws-daemon certificate: %w", err)
			}

			creds = credentials.NewTLS(tlsConfig)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		conn, err := grpc.DialContext(ctx, cfg.Address, grpc.WithTransportCredentials(creds))
		if err != nil {
			return err
		}
		defer conn.Close()

		client := grpc_health_v1.NewHealthClient(conn)
		check, err := client.Check(ctx, &grpc_health_v1.HealthCheckRequest{})
		if err != nil {
			return err
		}

		if check.Status == grpc_health_v1.HealthCheckResponse_SERVING {
			return nil
		}

		return fmt.Errorf("grpc service not ready")
	}
}

// createLVMDevices creates LVM logical volume special files missing when we run inside a container.
// Without this devices we cannot enforce disk quotas. In installations without LVM this is a NOOP.
func createLVMDevices() {
	cmd := exec.Command("/usr/sbin/vgmknodes")
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.WithError(err).WithField("out", string(out)).Error("cannot recreate LVM files in /dev/mapper")
	}
}
