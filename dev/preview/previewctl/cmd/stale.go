// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"golang.org/x/sync/errgroup"
	"k8s.io/client-go/util/homedir"

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
			if _, err := os.Stat(opts.sshPrivateKeyPath); errors.Is(err, fs.ErrNotExist) {
				return preview.InstallVMSSHKeys()
			}

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
	cmd.PersistentFlags().StringVar(&opts.sshPrivateKeyPath, "private-key-path", fmt.Sprintf("%s/.ssh/vm_id_rsa", homedir.HomeDir()), "path to the private key used to authenticate with the VM")

	return cmd
}

func (o *listWorkspaceOpts) listWorskpaceStatus(ctx context.Context) ([]preview.Status, error) {
	o.logger.Debug("Getting recent branches")
	branches, err := preview.GetRecentBranches(time.Now().AddDate(0, 0, -30))
	if err != nil {
		return nil, err
	}

	o.logger.Debug("Getting terraform workspaces")
	workspaces, err := o.getWorkspaces(ctx)
	if err != nil {
		return nil, err
	}

	o.logger.Debug("Finding workspaces without associated branches")
	branchlessWorkspaces, err := getBranchlessWorkspaces(workspaces, branches)
	if err != nil {
		return nil, err
	}

	wg, ctx := errgroup.WithContext(ctx)
	m := new(sync.Mutex)

	statuses := make([]preview.Status, 0, len(workspaces))
	for _, ws := range workspaces {
		ws := ws

		status := preview.Status{
			Name:   ws,
			Active: false,
		}

		if _, ok := branchlessWorkspaces[ws]; ok && !strings.HasPrefix(ws, "platform-") {
			status.Reason = "branch doesn't exist, or last commit older than 30 days"
			statuses = append(statuses, status)
			continue
			// there's (should be) nothing in the default worskpace, and we ignore main
		} else if ws == "default" || ws == "main" {
			continue
		}

		wg.Go(func() error {
			p, err := preview.New(ws, o.logger)
			if err != nil {
				status.Reason = err.Error()
				statuses = append(statuses, status)
				return nil
			}

			o.logger.WithFields(logrus.Fields{
				"preview": ws,
			}).Debug("Installing context")

			err = p.InstallContext(ctx, &preview.InstallCtxOpts{
				Retry:                true,
				RetryTimeout:         o.timeout,
				KubeSavePath:         getKubeConfigPath(),
				SSHPrivateKeyPath:    o.sshPrivateKeyPath,
				KubeconfigWriteMutex: m,
			})

			if err != nil {
				status.Reason = fmt.Sprintf("error installing context: [%v]", err)
				statuses = append(statuses, status)
				return nil
			}

			active, err := p.GetStatus(ctx)
			if err != nil {
				o.logger.WithFields(logrus.Fields{
					"preview": ws,
				}).Error(err)
			}
			statuses = append(statuses, active)

			return nil
		})
	}

	err = wg.Wait()
	if err != nil {
		return nil, err
	}

	return statuses, err
}

// getBranchlessWorkspaces Returns all workspaces for which there is no matching branch provided in the list
func getBranchlessWorkspaces(workspaces []string, branches map[string]preview.BranchMap) (map[string]struct{}, error) {
	nonExisting := map[string]struct{}{}
	for _, p := range workspaces {
		p := strings.TrimSpace(p)
		if _, ok := branches[p]; p != "default" && !ok {
			nonExisting[p] = struct{}{}
			continue
		}
	}

	return nonExisting, nil
}
