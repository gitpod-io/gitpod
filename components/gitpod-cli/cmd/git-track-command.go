// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"io"
	"os"
	"time"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	gitpod "github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
)

var gitTrackCommandOpts struct {
	GitCommand string
}

var gitTrackCommand = &cobra.Command{
	Use:    "git-track-command",
	Short:  "Gitpod's Git command tracker",
	Long:   "Sending anonymous statistics about the executed git commands inside a workspace",
	Args:   cobra.ExactArgs(0),
	Hidden: true,
	Run: func(cmd *cobra.Command, args []string) {
		log.SetOutput(io.Discard)
		f, err := os.OpenFile(os.TempDir()+"/gitpod-git-credential-helper.log", os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
		if err == nil {
			defer f.Close()
			log.SetOutput(f)
		}

		log.Infof("gp git-track-command")

		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
		defer cancel()
		wsInfo, err := gitpod.GetWSInfo(ctx)
		if err != nil {
			fail(err.Error())
		}

		client, err := gitpod.ConnectToServer(ctx, wsInfo, []string{"function:trackEvent"})

		if err != nil {
			log.WithError(err).Fatal("error connecting to supervisor")
		}

		defer client.Close()

		type GitEventParams struct {
			Command             string `json:"command,omitempty"`
			WorkspaceId         string `json:"workspaceId,omitempty"`
			WorkspaceInstanceId string `json:"workspaceInstanceId,omitempty"`
			Timestamp           int64  `json:"timestamp,omitempty"`
		}

		params := &GitEventParams{
			Command:             gitTrackCommandOpts.GitCommand,
			WorkspaceId:         wsInfo.WorkspaceId,
			WorkspaceInstanceId: wsInfo.InstanceId,
			Timestamp:           time.Now().Unix(),
		}
		event := &serverapi.RemoteTrackMessage{
			Event:      "git_command",
			Properties: *params,
		}
		log.WithField("command", gitTrackCommandOpts.GitCommand).
			Info("tracking the GitCommand event")

		err = client.TrackEvent(ctx, event)
		if err != nil {
			log.WithError(err).Fatal("error tracking git event")
		}
	},
}

func init() {
	rootCmd.AddCommand(gitTrackCommand)
	gitTrackCommand.Flags().StringVarP(&gitTrackCommandOpts.GitCommand, "gitCommand", "c", "", "The Git command to be recorded")
	gitTrackCommand.MarkFlagRequired("gitCommand")
}
