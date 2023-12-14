// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"os"
	"os/exec"
	"syscall"
	"time"

	"golang.org/x/xerrors"
	"k8s.io/klog/v2"

	"github.com/bombsimon/logrusr/v2"
	"github.com/heptiolabs/healthcheck"
	"github.com/spf13/cobra"
	ctrl "sigs.k8s.io/controller-runtime"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
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

		baseLogger := logrusr.New(log.Log)
		ctrl.SetLogger(baseLogger)
		// Set the logger used by k8s (e.g. client-go).
		klog.SetLogger(baseLogger)

		dmn, err := daemon.NewDaemon(cfg.Daemon)
		if err != nil {
			log.WithError(err).Fatal("Cannot create daemon.")
		}

		health := healthcheck.NewHandler()
		srv, err := baseserver.New(grpcServerName,
			baseserver.WithGRPC(&cfg.Service),
			baseserver.WithHealthHandler(health),
			baseserver.WithMetricsRegistry(dmn.MetricsRegistry()),
			baseserver.WithVersion(Version),
		)
		if err != nil {
			log.WithError(err).Fatal("Cannot set up server.")
		}

		health.AddReadinessCheck("ws-daemon", dmn.ReadinessProbe())
		health.AddReadinessCheck("disk-space", freeDiskSpace(cfg.Daemon))

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

// createLVMDevices creates LVM logical volume special files missing when we run inside a container.
// Without this devices we cannot enforce disk quotas. In installations without LVM this is a NOOP.
func createLVMDevices() {
	cmd := exec.Command("/usr/sbin/vgmknodes")
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.WithError(err).WithField("out", string(out)).Error("cannot recreate LVM files in /dev/mapper")
	}
}

func freeDiskSpace(cfg daemon.Config) func() error {
	return func() error {
		var diskDiskAvailable uint64 = 1
		for _, loc := range cfg.DiskSpaceGuard.Locations {
			if loc.Path == cfg.Content.WorkingArea {
				diskDiskAvailable = loc.MinBytesAvail
			}
		}

		var stat syscall.Statfs_t
		err := syscall.Statfs(cfg.Content.WorkingArea, &stat)
		if err != nil {
			return xerrors.Errorf("cannot get disk space details from path %s: %w", cfg.Content.WorkingArea, err)
		}

		diskAvailable := stat.Bavail * uint64(stat.Bsize) * (1024 * 1024 * 1024) // In GB
		if diskAvailable < diskDiskAvailable {
			return xerrors.Errorf("not enough disk available (%v)", diskAvailable)
		}

		return nil
	}
}
