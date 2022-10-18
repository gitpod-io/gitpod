// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/log"
	api "github.com/gitpod-io/gitpod/ide-service-api"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func init() {
	rootCmd.AddCommand(testCommand)
}

var testCommand = &cobra.Command{
	Use:     "test",
	Short:   "Exec GRPC test",
	Version: Version,
	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()
		conn, err := grpc.Dial(cfg.Server.Services.GRPC.Address, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			log.Fatal(err)
		}
		client := api.NewIDEServiceClient(conn)
		resp, err := client.GetConfig(context.Background(), &api.GetConfigRequest{})
		if err != nil {
			log.WithError(err).Error("cannot get config")
			return
		}
		fmt.Println(resp.Content)
	},
}
