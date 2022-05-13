// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/image-builder/pkg/orchestrator"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"

	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/spf13/cobra"
)

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the image-builder service",
	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()

		common_grpc.SetupLogging()
		reg := prometheus.NewRegistry()
		reg.MustRegister(
			collectors.NewGoCollector(),
			collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
			// BEWARE: for the gRPC client side metrics to work it's important to call common_grpc.ClientMetrics()
			//         before NewOrchestratingBuilder as the latter produces the gRPC client.
			common_grpc.ClientMetrics(),
		)

		srv, err := baseserver.New("image-builder-mk3",
			baseserver.WithGRPC(&cfg.Service),
		)
		if err != nil {
			log.Fatal(err)
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
		if reg != nil {
			err = service.RegisterMetrics(reg)
			if err != nil {
				log.Fatal(err)
			}
		}

		err = service.Start(ctx)
		if err != nil {
			log.Fatal(err)
		}

		api.RegisterImageBuilderServer(srv.GRPC(), service)
		err = srv.ListenAndServe()
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
