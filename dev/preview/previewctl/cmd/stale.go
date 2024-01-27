// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/previewctl/pkg/preview"
)

func newListStaleCmd(logger *logrus.Logger) *cobra.Command {
	ctx := context.Background()
	opts := &listWorkspaceOpts{
		logger: logger,
	}

	cmd := &cobra.Command{
		Use:   "stale",
		Short: "Get preview envs that are inactive (no branch with recent commits, and no db activity in the last 48h)",
		RunE: func(cmd *cobra.Command, args []string) error {
			statuses, err := opts.listWorskpaceStatus(ctx)
			if err != nil {
				return err
			}

			for _, ws := range statuses {
				// this goes to stderr and is informational
				opts.logger.WithFields(logrus.Fields{
					"preview": ws.Name,
					"active":  ws.Active,
					"reason":  ws.Reason,
				}).Info()

				// this to stdout, so we can capture it easily
				if !ws.Active {
					fmt.Println(ws.Name)
				}
			}

			return nil
		},
	}

	cmd.PersistentFlags().StringVar(&opts.TFDir, "tf-dir", "dev/preview/infrastructure", "TF working directory")
	cmd.Flags().DurationVarP(&opts.timeout, "timeout", "t", 10*time.Minute, "Duration to wait for a preview enviroment contexts' to get installed")

	return cmd
}

func (o *listWorkspaceOpts) listWorskpaceStatus(ctx context.Context) ([]preview.Status, error) {

	o.logger.Debug("Getting recent branches")
	branches, err := preview.GetRecentBranches(time.Now().AddDate(0, 0, -2))
	if err != nil {
		return nil, err
	}

	o.logger.Debug("Getting terraform workspaces")
	workspaces, err := o.getWorkspaces(ctx)
	if err != nil {
		return nil, err
	}

	statuses := make([]preview.Status, 0, len(workspaces))
	for _, ws := range workspaces {
		ws := ws

		if _, ok := branches[ws]; ok {
			statuses = append(statuses, preview.Status{
				Name:   ws,
				Active: true,
				Reason: "Branch has recent commits on it",
			})
			continue
		}

		p, err := preview.New(ws, o.logger)
		if err != nil {
			statuses = append(statuses, preview.Status{
				Name:   ws,
				Active: false,
				Reason: err.Error(),
			})
			continue
		}

		status, err := p.GetStatus(ctx)
		if err != nil {
			statuses = append(statuses, preview.Status{
				Name:   ws,
				Active: false,
				Reason: err.Error(),
			})
			continue
		}

		statuses = append(statuses, status)
	}

	return statuses, err
}
