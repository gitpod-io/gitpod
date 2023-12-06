// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/bufbuild/connect-go"
	experimental_v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
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
		gitpod, err := getGitpodClientV1(cmd.Context())
		if err != nil {
			return err
		}
		gitpodExperimental, err := getGitpodClient(cmd.Context())
		if err != nil {
			return err
		}

		if workspaceCreateOpts.WorkspaceClass != "" {
			resp, err := gitpod.Workspace.ListWorkspaceClasses(cmd.Context(), connect.NewRequest(&v1.ListWorkspaceClassesRequest{}))
			if err != nil {
				return prettyprint.MarkExceptional(prettyprint.AddResolution(fmt.Errorf("cannot list workspace classes: %w", err),
					"don't pass an explicit workspace class, i.e. omit the --class flag",
				))
			}
			var (
				classes []string
				found   bool
			)
			for _, cls := range resp.Msg.GetWorkspaceClasses() {
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
			resp, err := gitpodExperimental.Editors.ListEditorOptions(cmd.Context(), connect.NewRequest(&experimental_v1.ListEditorOptionsRequest{}))
			if err != nil {
				return prettyprint.MarkExceptional(prettyprint.AddResolution(fmt.Errorf("cannot list editor options: %w", err),
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
		newWorkspace, err := gitpod.Workspace.CreateAndStartWorkspace(ctx, connect.NewRequest(
			&v1.CreateAndStartWorkspaceRequest{
				Source: &v1.CreateAndStartWorkspaceRequest_ContextUrl{
					ContextUrl: &v1.CreateAndStartWorkspaceRequest_ContextURL{
						Url:            repoURL,
						WorkspaceClass: workspaceCreateOpts.WorkspaceClass,
						Editor: &v1.EditorReference{
							Name: workspaceCreateOpts.Editor,
						},
					},
				},
				Metadata: &v1.WorkspaceMetadata{
					OrganizationId:  orgId,
					ConfigurationId: workspaceCreateOpts.ConfigurationID,
				},
			},
		))
		if err != nil {
			if ce := new(connect.Error); errors.As(err, &ce) && ce.Code() == connect.CodeInvalidArgument {
				if ce.Message() == "Multiple projects found for clone URL." {
					return prettyprint.AddResolution(fmt.Errorf("multiple repository configurations correspond to %s", repoURL),
						"use --configuration to specify the ID of your preferred context",
					)
				}
			} else {
				slog.Debug("Something happened with code", "code", ce.Code())
			}
			return err
		}

		workspaceID := newWorkspace.Msg.Workspace.Id
		if len(workspaceID) == 0 {
			return prettyprint.MarkExceptional(prettyprint.AddResolution(fmt.Errorf("workspace was not created"),
				"try to create the workspace again",
			))
		}

		if workspaceCreateOpts.StartOpts.DontWait {
			// There is no more information to print other than the workspace ID. No need to faff with tabular pretty printing.
			fmt.Println(workspaceID)
			return nil
		}

		_, err = helper.ObserveWorkspaceUntilStarted(ctx, gitpodExperimental, workspaceID)
		if err != nil {
			return err
		}

		if workspaceCreateOpts.StartOpts.OpenSSH {
			return helper.SSHConnectToWorkspace(ctx, gitpodExperimental, workspaceID, false)
		}
		if workspaceCreateOpts.StartOpts.OpenEditor {
			return helper.OpenWorkspaceInPreferredEditor(ctx, gitpodExperimental, workspaceID)
		}

		return nil
	},
}

var workspaceCreateOpts struct {
	StartOpts workspaceStartOptions

	WorkspaceClass  string
	Editor          string
	ConfigurationID string
}

func classCompletionFunc(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	ctx := cmd.Context()
	gitpod, err := getGitpodClient(ctx)
	if err != nil {
		return nil, cobra.ShellCompDirectiveError
	}
	resp, err := gitpod.Workspaces.ListWorkspaceClasses(ctx, connect.NewRequest(&experimental_v1.ListWorkspaceClassesRequest{}))
	if err != nil {
		return nil, cobra.ShellCompDirectiveError
	}
	items := resp.Msg.GetResult()
	completionStr := []string{}
	for _, cls := range items {
		defaultDesc := ""
		if cls.IsDefault {
			defaultDesc = "(default)"
		}
		completionStr = append(completionStr, fmt.Sprintf("%s\t%s%s - %s", cls.Id, cls.DisplayName, defaultDesc, cls.Description))
	}
	return completionStr, cobra.ShellCompDirectiveNoFileComp
}

func editorCompletionFunc(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
	ctx := cmd.Context()
	gitpod, err := getGitpodClient(ctx)
	if err != nil {
		return nil, cobra.ShellCompDirectiveError
	}
	resp, err := gitpod.Editors.ListEditorOptions(ctx, connect.NewRequest(&experimental_v1.ListEditorOptionsRequest{}))
	if err != nil {
		return nil, cobra.ShellCompDirectiveError
	}
	items := resp.Msg.GetResult()
	completionStr := []string{}
	for _, editor := range items {
		completionStr = append(completionStr, fmt.Sprintf("%s\t%s", editor.Id, editor.Title))
	}
	return completionStr, cobra.ShellCompDirectiveNoFileComp
}

func init() {
	workspaceCmd.AddCommand(workspaceCreateCmd)
	addWorkspaceStartOptions(workspaceCreateCmd, &workspaceCreateOpts.StartOpts)

	workspaceCreateCmd.Flags().StringVar(&workspaceCreateOpts.WorkspaceClass, "class", "", "the workspace class")
	workspaceCreateCmd.Flags().StringVar(&workspaceCreateOpts.Editor, "editor", "code", "the editor to use")
	workspaceCreateCmd.Flags().StringVar(&workspaceCreateOpts.ConfigurationID, "configuration", "", "the ID of the configuration to use")

	_ = workspaceCreateCmd.RegisterFlagCompletionFunc("class", classCompletionFunc)
	_ = workspaceCreateCmd.RegisterFlagCompletionFunc("editor", editorCompletionFunc)
}
