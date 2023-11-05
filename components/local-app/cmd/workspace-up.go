// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/helper"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/go-git/go-git/v5"
	gitcfg "github.com/go-git/go-git/v5/config"
	"github.com/gookit/color"
	"github.com/melbahja/goph"
	"github.com/spf13/cobra"
	"golang.org/x/crypto/ssh"
)

// workspaceUpCmd creates a new workspace
var workspaceUpCmd = &cobra.Command{
	Use:    "up [path/to/git/working-copy]",
	Hidden: true,
	Short:  "Creates a new workspace, pushes the Git working copy and adds it as remote",
	Args:   cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cmd.SilenceUsage = true

		workingDir := "."
		if len(args) != 0 {
			workingDir = args[0]
		}

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

		defer func() {
			// If the error doesn't have a resolution, assume it's a system error and add an apology
			if err != nil && !errors.Is(err, &prettyprint.ErrResolution{}) {
				err = prettyprint.AddApology(err)
			}
		}()

		currentDir, err := filepath.Abs(workingDir)
		if err != nil {
			return err
		}
		for {
			// Check if current directory contains .git folder
			_, err := os.Stat(filepath.Join(currentDir, ".git"))
			if err == nil {
				break
			}
			if !os.IsNotExist(err) {
				return err
			}

			// Move to the parent directory
			parentDir := filepath.Dir(currentDir)
			if parentDir == currentDir {
				// No more parent directories
				return prettyprint.AddResolution(fmt.Errorf("no Git repository found"),
					fmt.Sprintf("make sure %s is a valid Git repository", workingDir),
					"run `git clone` to clone an existing repository",
					"open a remote repository using `{gitpod} workspace create <repo-url>`",
				)
			}
			currentDir = parentDir
		}

		slog.Debug("found Git working copy", "dir", currentDir)
		repo, err := git.PlainOpen(currentDir)
		if err != nil {
			return prettyprint.AddApology(fmt.Errorf("cannot open Git working copy at %s: %w", currentDir, err))
		}
		_ = repo.DeleteRemote("gitpod")
		head, err := repo.Head()
		if err != nil {
			return prettyprint.AddApology(fmt.Errorf("cannot get HEAD: %w", err))
		}
		branch := head.Name().Short()

		newWorkspace, err := gitpod.Workspaces.CreateAndStartWorkspace(ctx, connect.NewRequest(
			&v1.CreateAndStartWorkspaceRequest{
				Source:         &v1.CreateAndStartWorkspaceRequest_ContextUrl{ContextUrl: "GITPODCLI_CONTENT_INIT=push/https://github.com/gitpod-io/empty"},
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
		ws, err := helper.ObserveWorkspaceUntilStarted(ctx, gitpod, workspaceID)
		if err != nil {
			return err
		}
		slog.Debug("workspace started", "workspaceID", workspaceID)

		token, err := gitpod.Workspaces.GetOwnerToken(ctx, connect.NewRequest(&v1.GetOwnerTokenRequest{WorkspaceId: workspaceID}))
		if err != nil {
			return err
		}
		var (
			ownerToken = token.Msg.Token
			host       = strings.TrimPrefix(strings.ReplaceAll(ws.Instance.Status.Url, workspaceID, workspaceID+".ssh"), "https://")
		)
		sess, err := goph.NewConn(&goph.Config{
			User:     fmt.Sprintf("%s#%s", workspaceID, ownerToken),
			Addr:     host,
			Callback: ssh.InsecureIgnoreHostKey(),
			Timeout:  10 * time.Second,
			Port:     22,
		})
		if err != nil {
			return prettyprint.AddResolution(fmt.Errorf("cannot connect to workspace: %w", err),
				"make sure you can connect to SSH servers on port 22",
			)
		}
		defer sess.Close()

		slog.Debug("initializing remote workspace Git repository")
		err = runSSHCommand(ctx, sess, "rm", "-r", "/workspace/empty/.git")
		if err != nil {
			return err
		}
		err = runSSHCommand(ctx, sess, "git", "init", "/workspace/empty")
		if err != nil {
			return err
		}

		slog.Debug("pushing to workspace")
		sshRemote := fmt.Sprintf("%s#%s@%s:/workspace/empty", workspaceID, ownerToken, helper.WorkspaceSSHHost(&v1.Workspace{WorkspaceId: workspaceID, Status: ws}))
		_, err = repo.CreateRemote(&gitcfg.RemoteConfig{
			Name: "gitpod",
			URLs: []string{sshRemote},
		})
		if err != nil {
			return fmt.Errorf("cannot create remote: %w", err)
		}

		// Pushing using Go git is tricky because of the SSH host verification. Shelling out to git is easier.
		slog.Info("pushing to local working copy to remote workspace")
		pushcmd := exec.Command("git", "push", "--progress", "gitpod")
		pushcmd.Stdout = os.Stdout
		pushcmd.Stderr = os.Stderr
		pushcmd.Dir = currentDir
		pushcmd.Env = append(os.Environ(), "GIT_SSH_COMMAND=ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null")
		err = pushcmd.Run()
		if err != nil {
			return fmt.Errorf("cannot push to remote: %w", err)
		}

		slog.Debug("checking out branch in workspace")
		err = runSSHCommand(ctx, sess, "sh -c 'cd /workspace/empty && git checkout "+branch+"'")
		if err != nil {
			return err
		}
		err = runSSHCommand(ctx, sess, "sh -c 'cd /workspace/empty && git config receive.denyCurrentBranch ignore'")
		if err != nil {
			return err
		}

		doneBanner := fmt.Sprintf("\n\n%s\n\nDon't forget to pull your changes to your local working copy before stopping the workspace.\nUse `cd %s && git pull gitpod %s`\n\n", color.New(color.FgGreen, color.Bold).Sprintf("Workspace ready!"), currentDir, branch)
		slog.Info(doneBanner)

		switch {
		case workspaceCreateOpts.StartOpts.OpenSSH:
			err = helper.SSHConnectToWorkspace(ctx, gitpod, workspaceID, false)
			if err != nil && err.Error() == "exit status 255" {
				err = nil
			} else if err != nil {
				return err
			}
		case workspaceCreateOpts.StartOpts.OpenEditor:
			return helper.OpenWorkspaceInPreferredEditor(ctx, gitpod, workspaceID)
		default:
			slog.Info("Access your workspace at", "url", ws.Instance.Status.Url)
		}
		return nil
	},
}

func runSSHCommand(ctx context.Context, sess *goph.Client, name string, args ...string) error {
	cmd, err := sess.Command(name, args...)
	if err != nil {
		return err
	}
	out := bytes.NewBuffer(nil)
	cmd.Stdout = out
	cmd.Stderr = out
	slog.Debug("running remote command", "cmd", name, "args", args)

	err = cmd.Run()
	if err != nil {
		return fmt.Errorf("%w: %s", err, out.String())
	}
	return nil
}

func init() {
	workspaceCmd.AddCommand(workspaceUpCmd)
	addWorkspaceStartOptions(workspaceUpCmd, &workspaceCreateOpts.StartOpts)

	workspaceUpCmd.Flags().StringVar(&workspaceCreateOpts.WorkspaceClass, "class", "", "the workspace class")
	workspaceUpCmd.Flags().StringVar(&workspaceCreateOpts.Editor, "editor", "code", "the editor to use")
}
