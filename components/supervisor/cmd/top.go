// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"
)

var topOpts struct {
	Json       bool
	Standalone bool
}

var topCmd = &cobra.Command{
	Use:   "top",
	Short: "Display resource (CPU/memory) usage of the workspace",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var (
			status *api.ResourcesStatusResponse
			err    error
		)
		if topOpts.Standalone {
			status, err = supervisor.Top(ctx)
		} else {
			client := api.NewStatusServiceClient(dialSupervisor())
			status, err = client.ResourcesStatus(ctx, &api.ResourcesStatuRequest{})
		}
		if err != nil {
			log.WithError(err).Fatal("failed to resolve")
		}

		if topOpts.Json {
			content, _ := json.Marshal(status)
			fmt.Println(string(content))
		} else {
			tw := tabwriter.NewWriter(os.Stdout, 6, 4, 3, ' ', 0)
			defer tw.Flush()

			fmt.Fprintf(tw, "CPU(millicores)\tMEMORY(bytes)\n")

			cpuFraction := int64((float64(status.Cpu.Used) / float64(status.Cpu.Limit)) * 100)
			memFraction := int64((float64(status.Memory.Used) / float64(status.Memory.Limit)) * 100)

			fmt.Fprintf(tw, "%dm/%dm (%d%%)\t%dMi/%dMi (%d%%)\n", status.Cpu.Used, status.Cpu.Limit, cpuFraction, status.Memory.Used/(1024*1024), status.Memory.Limit/(1024*1024), memFraction)
		}
	},
}

func init() {
	rootCmd.AddCommand(topCmd)
	topCmd.Flags().BoolVarP(&topOpts.Json, "json", "j", false, "print like json")
	topCmd.Flags().BoolVarP(&topOpts.Standalone, "standalone", "s", false, "standalone mode")
}
