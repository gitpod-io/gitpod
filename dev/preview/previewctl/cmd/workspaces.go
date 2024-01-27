// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os/exec"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/hashicorp/terraform-exec/tfexec"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

type listWorkspaceOpts struct {
	TFDir string

	logger  *logrus.Logger
	timeout time.Duration
}

func newListWorkspacesCmd(logger *logrus.Logger) *cobra.Command {
	ctx := context.Background()
	opts := &listWorkspaceOpts{
		logger: logger,
	}

	cmd := &cobra.Command{
		Use:   "workspaces",
		Short: "List all existing workspaces in the directory",
		RunE: func(cmd *cobra.Command, args []string) error {
			list, err := opts.getWorkspaces(ctx)
			if err != nil {
				return err
			}

			for _, ws := range list {
				fmt.Println(ws)
			}

			return nil
		},
	}

	cmd.PersistentFlags().StringVar(&opts.TFDir, "tf-dir", "dev/preview/infrastructure", "TF working directory")

	return cmd
}

func (o *listWorkspaceOpts) getWorkspaces(ctx context.Context) ([]string, error) {
	execPath, err := exec.LookPath("terraform")
	if err != nil {
		return nil, errors.Wrap(err, "error getting Terraform executable path")
	}

	tf, err := tfexec.NewTerraform(o.TFDir, execPath)
	if err != nil {
		return nil, errors.Wrap(err, "error running NewTerraform")
	}

	if d, err := tf.WorkspaceShow(ctx); err == nil && d != "default" {
		_ = tf.WorkspaceSelect(ctx, "default")
	}

	err = tf.Init(ctx, tfexec.Upgrade(true))
	if err != nil {
		return nil, errors.Wrap(err, "error running Init")
	}

	list, _, err := tf.WorkspaceList(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "error running list")
	}

	filtered := []string{}
	for i := range list {
		if list[i] != "default" {
			filtered = append(filtered, list[i])
		}
	}

	return filtered, nil
}
