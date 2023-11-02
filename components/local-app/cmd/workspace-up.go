// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/components/public-api/go/client"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/common"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/melbahja/goph"
	"github.com/sagikazarmark/slog-shim"
	"github.com/spf13/cobra"
	"golang.org/x/crypto/ssh"
	"golang.org/x/sys/unix"
)

//go:generate sh -c "GOOS=linux CGO_ENABLED=0 go build -o gitserver/gitserver gitserver/main.go"

//go:embed gitserver/gitserver
var gitserver []byte

// workspaceUpCmd creates a new workspace
var workspaceUpCmd = &cobra.Command{
	Use:   "up",
	Short: "Creates a new workspace and pushes the local Git working copy",
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		ctx := context.Background()

		orgId := getOrganizationID()
		if len(orgId) == 0 {
			return fmt.Errorf("no organisation specified. Specify an organization ID using the GITPOD_ORG_ID environment variable")
		}

		gitpod, err := common.GetGitpodClient(ctx)
		if err != nil {
			return err
		}

		currentDir, err := filepath.Abs(workspaceUpOpts.WorkingDir)
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
				return fmt.Errorf("no Git repository found")
			}
			currentDir = parentDir
		}

		repo, err := git.PlainOpen(currentDir)
		if err != nil {
			return fmt.Errorf("cannot open git working copy at %s: %w", currentDir, err)
		}
		_ = repo.DeleteRemote("gitpod")
		head, err := repo.Head()
		if err != nil {
			return fmt.Errorf("cannot get HEAD: %w", err)
		}
		branch := head.Name().Short()

		newWorkspace, err := gitpod.Workspaces.CreateAndStartWorkspace(ctx, connect.NewRequest(
			&v1.CreateAndStartWorkspaceRequest{
				Source:         &v1.CreateAndStartWorkspaceRequest_ContextUrl{ContextUrl: "GITPODCLI_CONTENT_INIT=push/https://github.com/gitpod-io/empty"},
				OrganizationId: orgId,
				StartSpec: &v1.StartWorkspaceSpec{
					IdeSettings: &v1.IDESettings{
						DefaultIde:       workspaceUpOpts.Editor,
						UseLatestVersion: false,
					},
					WorkspaceClass: workspaceUpOpts.WorkspaceClass,
				}}))

		if err != nil {
			return err
		}

		workspaceID := newWorkspace.Msg.WorkspaceId

		if len(workspaceID) == 0 {
			return fmt.Errorf("did not receive a workspace ID from the API; please try creating the workspace again")
		}

		ws, err := common.ObserveWorkspaceUntilStarted(ctx, workspaceID)
		if err != nil {
			return err
		}
		defer gitpod.Workspaces.StopWorkspace(ctx, connect.NewRequest(&v1.StopWorkspaceRequest{WorkspaceId: workspaceID}))

		var waitForSigterm bool
		defer func() {
			if err != nil {
				slog.Info("caught error - waiting for debugging", "err", err)
				waitForSigterm = true
			}
			if !waitForSigterm {
				return
			}
			c := make(chan os.Signal, 1)
			signal.Notify(c, unix.SIGINT, unix.SIGTERM)
			<-c
		}()

		_, err = gitpod.Workspaces.UpdatePort(ctx, connect.NewRequest(&v1.UpdatePortRequest{
			WorkspaceId: workspaceID,
			Port:        &v1.PortSpec{Port: 9999, Policy: v1.PortPolicy_PORT_POLICY_PUBLIC},
		}))
		if err != nil {
			return err
		}

		slog.Info("starting Git server")
		sess, err := hackStartGitServer(ctx, gitpod, ws)
		if err != nil {
			return err
		}
		defer sess.Close()

		slog.Info("pushing to remote")
		gitRemoteURL, err := url.Parse(ws.Instance.Status.Url)
		if err != nil {
			return err
		}
		gitRemoteURL.Host = fmt.Sprintf("9999-%s", gitRemoteURL.Host)
		gitRemoteURL.Path = "/remote-repo"
		remote, err := repo.CreateRemote(&config.RemoteConfig{
			Name: "gitpod",
			URLs: []string{gitRemoteURL.String()},
		})
		if err != nil {
			return fmt.Errorf("cannot create remote: %w", err)
		}
		err = remote.Push(&git.PushOptions{
			RemoteName: "gitpod",
		})
		if err != nil {
			return fmt.Errorf("cannot push to remote: %w", err)
		}

		err = hackGitCheckoutRemote(ctx, sess, branch)
		if err != nil {
			return err
		}

		if workspaceUpOpts.OpenSSH {
			err = common.SSHConnectToWorkspace(ctx, workspaceID, false)
			if err != nil && err.Error() == "exit status 255" {
				err = nil
			}
		} else if workspaceUpOpts.OpenEditor {
			waitForSigterm = true
			err = common.OpenWsInPreferredEditor(ctx, workspaceID)
		} else {
			waitForSigterm = true
			slog.Info("🎉 Workspace ready", "url", ws.Instance.Status.Url)
		}
		if err != nil {
			return err
		}
		slog.Info("Press Ctrl+C to stop the workspace")

		return nil
	},
}

func hackStartGitServer(ctx context.Context, clnt *client.Gitpod, ws *v1.WorkspaceStatus) (*goph.Client, error) {
	workspaceID := ws.Instance.WorkspaceId
	token, err := clnt.Workspaces.GetOwnerToken(ctx, connect.NewRequest(&v1.GetOwnerTokenRequest{WorkspaceId: workspaceID}))
	if err != nil {
		return nil, err
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
		return nil, err
	}

	err = uploadBytesToSSH(sess, "/tmp/gitserver", gitserver, 0755)
	if err != nil {
		return nil, err
	}

	cmd, err := sess.Command("nohup /tmp/gitserver &")
	if err != nil {
		return nil, err
	}
	cmd.Stdout = os.Stdout
	err = cmd.Start()
	if err != nil {
		return nil, fmt.Errorf("cannot start git server: %w", err)
	}

	return sess, nil
}

func uploadBytesToSSH(c *goph.Client, remotePath string, content []byte, fileMode fs.FileMode) error {
	ftp, err := c.NewSftp()
	if err != nil {
		return err
	}
	defer ftp.Close()

	remote, err := ftp.Create(remotePath)
	if err != nil {
		return err
	}
	defer remote.Close()

	_, err = io.Copy(remote, bytes.NewReader(content))
	if err != nil {
		return err
	}

	err = ftp.Chmod(remotePath, fileMode)
	if err != nil {
		return err
	}

	return nil
}

func hackGitCheckoutRemote(ctx context.Context, sshSess *goph.Client, branch string) error {
	cmd, err := sshSess.Command("sh -c 'rm -rf /workspace/empty/.git && git clone http://localhost:9999/remote-repo /workspace/empty && cd /workspace/empty && git checkout " + branch + "'")
	if err != nil {
		return err
	}
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

var workspaceUpOpts struct {
	WorkspaceClass string
	WorkingDir     string
	Editor         string
	OpenSSH        bool
	OpenEditor     bool
}

func init() {
	workspaceCmd.AddCommand(workspaceUpCmd)
	workspaceUpCmd.Flags().StringVarP(&workspaceUpOpts.WorkspaceClass, "class", "c", "", "the workspace class")
	workspaceUpCmd.Flags().StringVarP(&workspaceUpOpts.Editor, "editor", "e", "", "the editor to use")
	workspaceUpCmd.Flags().BoolVar(&workspaceUpOpts.OpenSSH, "ssh", false, "open an SSH connection to workspace after starting")
	workspaceUpCmd.Flags().BoolVarP(&workspaceUpOpts.OpenEditor, "open", "o", false, "open the workspace in an editor after starting")
	workspaceUpCmd.Flags().StringVar(&workspaceUpOpts.WorkingDir, "cwd", ".", "the working directory to use")
}
