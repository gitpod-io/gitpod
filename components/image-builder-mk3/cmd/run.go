// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/image-builder/pkg/orchestrator"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"

	"github.com/opentracing/opentracing-go"
	"github.com/spf13/cobra"
)

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the image-builder service",
	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()
		log.WithField("config", cfg).Info("Starting image-builder-mk3")

		srv, err := baseserver.New("image-builder-mk3",
			baseserver.WithConfig(cfg.Server),
			baseserver.WithVersion(Version),
		)
		if err != nil {
			log.WithError(err).Fatal("Failed to setup server.")
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		span, ctx := opentracing.StartSpanFromContext(ctx, "/cmd/Run")
		defer span.Finish()

		service, err := orchestrator.NewOrchestratingBuilder(cfg.Orchestrator)
		if err != nil {
			log.Fatal(err)
		}
		if cfg.RefCache.Interval != "" && len(cfg.RefCache.Refs) > 0 {
			interval, err := time.ParseDuration(cfg.RefCache.Interval)
			if err != nil {
				log.WithError(err).WithField("interval", cfg.RefCache.Interval).Fatal("interval is not a valid duration")
			}

			resolver := &resolve.PrecachingRefResolver{
				Resolver:   &resolve.StandaloneRefResolver{},
				Candidates: cfg.RefCache.Refs,
			}
			go resolver.StartCaching(ctx, interval)
			service.RefResolver = resolver
		}

		err = service.RegisterMetrics(srv.MetricsRegistry())
		if err != nil {
			log.WithError(err).Fatal("Failed to register metrics.")
		}

		err = service.Start(ctx)
		if err != nil {
			log.WithError(err).Fatal("Failed to start orchestrator service.")
		}

		api.RegisterImageBuilderServer(srv.GRPC(), service)

		err = srv.ListenAndServe()
		if err != nil {
			log.WithError(err).Fatal("Failed to start server")
		}
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
