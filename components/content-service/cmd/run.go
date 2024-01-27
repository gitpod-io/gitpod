// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/service"
	"github.com/spf13/cobra"
)

// runCmd starts the content service
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the content service",

	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()

		srv, err := baseserver.New("content-service",
			baseserver.WithGRPC(&cfg.Service),
			baseserver.WithVersion(Version),
		)
		if err != nil {
			log.WithError(err).Fatal("Failed to create server.")
		}

		contentService, err := service.NewContentService(cfg.Storage)
		if err != nil {
			log.WithError(err).Fatalf("Cannot create content service")
		}
		api.RegisterContentServiceServer(srv.GRPC(), contentService)

		blobService, err := service.NewBlobService(cfg.Storage)
		if err != nil {
			log.WithError(err).Fatalf("Cannot create blobs service")
		}
		api.RegisterBlobServiceServer(srv.GRPC(), blobService)

		workspaceService, err := service.NewWorkspaceService(cfg.Storage)
		if err != nil {
			log.WithError(err).Fatalf("Cannot create workspace service")
		}
		api.RegisterWorkspaceServiceServer(srv.GRPC(), workspaceService)

		headlessLogService, err := service.NewHeadlessLogService(cfg.Storage)
		if err != nil {
			log.WithError(err).Fatalf("Cannot create log service")
		}
		api.RegisterHeadlessLogServiceServer(srv.GRPC(), headlessLogService)

		idePluginService, err := service.NewIDEPluginService(cfg.Storage)
		if err != nil {
			log.WithError(err).Fatalf("Cannot create IDE Plugin service")
		}
		api.RegisterIDEPluginServiceServer(srv.GRPC(), idePluginService)

		err = srv.ListenAndServe()
		if err != nil {
			log.WithError(err).Fatal("Cannot start server")
		}
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
