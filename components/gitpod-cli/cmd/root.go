// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/spf13/cobra"
)

type contextKey int

const (
	ctxKeyAnalytics        contextKey = iota
	ctxKeySupervisorClient contextKey = iota
	rootCmdName                       = "gp"
)

var rootCmd = &cobra.Command{
	Use:   rootCmdName,
	Short: "Command line interface for Gitpod",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		ctx := context.Background()
		supervisorClient, err := supervisor.New(ctx)
		if err != nil {
			utils.LogError(ctx, err, "Could not get workspace info", supervisorClient)
			return
		}
		defer supervisorClient.Close()

		cmdName := strings.TrimSpace(strings.TrimPrefix(cmd.CommandPath(), rootCmdName))
		event := utils.NewAnalyticsEvent(ctx, supervisorClient, &utils.TrackCommandUsageParams{
			Command: cmdName,
		})

		analyticsCtx := context.WithValue(cmd.Context(), ctxKeyAnalytics, event)
		cmd.SetContext(analyticsCtx)

		supervisorClientCtx := context.WithValue(cmd.Context(), ctxKeySupervisorClient, supervisorClient)
		cmd.SetContext(supervisorClientCtx)
	},
	PersistentPostRun: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()
		event := ctx.Value(ctxKeyAnalytics).(*utils.AnalyticsEvent)
		event.Send(ctx)
	},
}

var noColor bool

// Execute runs the root command
func Execute() {
	entrypoint := strings.TrimPrefix(filepath.Base(os.Args[0]), "gp-")
	for _, c := range rootCmd.Commands() {
		if c.Name() == entrypoint {
			// we can't call subcommands directly (they just call their parents - thanks cobra),
			// so instead we have to manipulate the os.Args
			os.Args = append([]string{os.Args[0], entrypoint}, os.Args[1:]...)
			break
		}
	}

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
