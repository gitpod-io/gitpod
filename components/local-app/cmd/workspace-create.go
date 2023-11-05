// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/helper"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/spf13/cobra"
)

// workspaceCreateCmd creates a new workspace
var workspaceCreateCmd = &cobra.Command{
	Use:   "create <repo-url>",
	Short: "Creates a new workspace based on a given context",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true
		repoURL := args[0]

		cfg := config.FromContext(cmd.Context())
		gpctx, err := cfg.GetActiveContext()
		if err != nil {
			return err
		}
		gitpod, err := getGitpodClient(cmd.Context())
		if err != nil {
			return err
		}

		if workspaceCreateOpts.WorkspaceClass != "" {
			resp, err := gitpod.Workspaces.ListWorkspaceClasses(cmd.Context(), connect.NewRequest(&v1.ListWorkspaceClassesRequest{}))
			if err != nil {
				return prettyprint.AddApology(prettyprint.AddResolution(fmt.Errorf("cannot list workspace classes: %w", err),
					"don't pass an explicit workspace class, i.e. omit the --class flag",
				))
			}
			var (
				classes []string
				found   bool
			)
			for _, cls := range resp.Msg.GetResult() {
				classes = append(classes, cls.Id)
				if cls.Id == workspaceCreateOpts.WorkspaceClass {
					found = true
				}
			}
			if !found {
				return prettyprint.AddResolution(fmt.Errorf("workspace class %s not found", workspaceCreateOpts.WorkspaceClass),
					fmt.Sprintf("use one of the available workspace classes: %s", strings.Join(classes, ", ")),
				)
			}
		}

		if workspaceCreateOpts.Editor != "" {
			resp, err := gitpod.Editors.ListEditorOptions(cmd.Context(), connect.NewRequest(&v1.ListEditorOptionsRequest{}))
			if err != nil {
				return prettyprint.AddApology(prettyprint.AddResolution(fmt.Errorf("cannot list editor options: %w", err),
					"don't pass an explicit editor, i.e. omit the --editor flag",
				))
			}
			var (
				editors []string
				found   bool
			)
			for _, editor := range resp.Msg.GetResult() {
				editors = append(editors, editor.Id)
				if editor.Id == workspaceCreateOpts.Editor {
					found = true
				}
			}
			if !found {
				return prettyprint.AddResolution(fmt.Errorf("editor %s not found", workspaceCreateOpts.Editor),
					fmt.Sprintf("use one of the available editor options: %s", strings.Join(editors, ", ")),
				)
			}
		}

		var (
			orgId = gpctx.OrganizationID
			ctx   = cmd.Context()
		)

		slog.Debug("Attempting to create workspace...", "org", orgId, "repo", repoURL)
		newWorkspace, err := gitpod.Workspaces.CreateAndStartWorkspace(ctx, connect.NewRequest(
			&v1.CreateAndStartWorkspaceRequest{
				Source:         &v1.CreateAndStartWorkspaceRequest_ContextUrl{ContextUrl: repoURL},
				OrganizationId: orgId,
				StartSpec: &v1.StartWorkspaceSpec{
					IdeSettings: &v1.IDESettings{
						DefaultIde:       workspaceCreateOpts.Editor,
						UseLatestVersion: false,
					},
					WorkspaceClass: workspaceCreateOpts.WorkspaceClass,
				},
			},
		))
		if err != nil {
			return err
		}

		workspaceID := newWorkspace.Msg.WorkspaceId
		if len(workspaceID) == 0 {
			return prettyprint.AddApology(prettyprint.AddResolution(fmt.Errorf("workspace was not created"),
				"try to create the workspace again",
			))
		}

		if workspaceCreateOpts.StartOpts.DontWait {
			// There is no more information to print other than the workspace ID. No need to faff with tabular pretty printing.
			fmt.Println(workspaceID)
			return nil
		}

		_, err = helper.ObserveWorkspaceUntilStarted(ctx, gitpod, workspaceID)
		if err != nil {
			return err
		}

		if workspaceCreateOpts.StartOpts.OpenSSH {
			return helper.SSHConnectToWorkspace(ctx, gitpod, workspaceID, false)
		}
		if workspaceCreateOpts.StartOpts.OpenEditor {
			return helper.OpenWorkspaceInPreferredEditor(ctx, gitpod, workspaceID)
		}

		return nil
	},
}

var workspaceCreateOpts struct {
	StartOpts workspaceStartOptions

	WorkspaceClass string
	Editor         string
}

func init() {
	workspaceCmd.AddCommand(workspaceCreateCmd)
	addWorkspaceStartOptions(workspaceCreateCmd, &workspaceCreateOpts.StartOpts)

	workspaceCreateCmd.Flags().StringVar(&workspaceCreateOpts.WorkspaceClass, "class", "", "the workspace class")
	workspaceCreateCmd.Flags().StringVar(&workspaceCreateOpts.Editor, "editor", "code", "the editor to use")
}
