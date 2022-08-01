// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/prometheus/procfs"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

var credentialHelper = &cobra.Command{
	Use:    "credential-helper get",
	Short:  "Gitpod Credential Helper for Git",
	Long:   "Supports reading of credentials per host.",
	Args:   cobra.MinimumNArgs(1),
	Hidden: true,
	Run: func(cmd *cobra.Command, args []string) {
		action := args[0]
		log.SetOutput(io.Discard)
		f, err := os.OpenFile(os.TempDir()+"/gitpod-git-credential-helper.log", os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
		if err == nil {
			defer f.Close()
			log.SetOutput(f)
		}
		if action != "get" {
			return
		}

		result, err := parseFromStdin()
		host := result["host"]
		if err != nil || host == "" {
			log.WithError(err).Print("error parsing 'host' from stdin")
			return
		}

		var user, token string
		defer func() {
			// Server could return only the token and not the username, so we fallback to hardcoded `oauth2` username.
			// See https://github.com/gitpod-io/gitpod/pull/7889#discussion_r801670957
			if token != "" && user == "" {
				user = "oauth2"
			}
			if token != "" {
				result["username"] = user
				result["password"] = token
			}
			for k, v := range result {
				fmt.Printf("%s=%s\n", k, v)
			}
		}()

		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
		defer cancel()

		supervisorAddr := os.Getenv("SUPERVISOR_ADDR")
		if supervisorAddr == "" {
			supervisorAddr = "localhost:22999"
		}
		supervisorConn, err := grpc.Dial(supervisorAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			log.WithError(err).Print("error connecting to supervisor")
			return
		}

		resp, err := supervisor.NewTokenServiceClient(supervisorConn).GetToken(ctx, &supervisor.GetTokenRequest{
			Host: host,
			Kind: "git",
		})
		if err != nil {
			log.WithError(err).Print("error getting token from supervisior")
			return
		}

		user = resp.User
		token = resp.Token

		gitCmdInfo := &gitCommandInfo{}
		err = walkProcessTree(os.Getpid(), func(proc procfs.Proc) bool {
			cmdLine, err := proc.CmdLine()
			if err != nil {
				log.WithError(err).Print("error reading proc cmdline")
				return true
			}

			cmdLineString := strings.Join(cmdLine, " ")
			log.Printf("cmdLineString -> %v", cmdLineString)
			gitCmdInfo.parseGitCommandAndRemote(cmdLineString)

			return gitCmdInfo.Ok()
		})
		if err != nil {
			log.WithError(err).Print("error walking process tree")
			return
		}
		if !gitCmdInfo.Ok() {
			log.Warn(`Could not detect "RepoUrl" and or "GitCommand", token validation will not be performed`)
			return
		}

		// Starts another process which tracks the executed git event
		gitCommandTracker := exec.Command("/proc/self/exe", "git-track-command", "--gitCommand", gitCmdInfo.GitCommand)
		err = gitCommandTracker.Start()
		if err != nil {
			log.WithError(err).Print("error spawning tracker")
		} else {
			err = gitCommandTracker.Process.Release()
			if err != nil {
				log.WithError(err).Print("error releasing tracker")
			}
		}

		validator := exec.Command(
			"/proc/self/exe",
			"git-token-validator",
			"--user", resp.User,
			"--token", resp.Token,
			"--scopes", strings.Join(resp.Scope, ","),
			"--host", host,
			"--repoURL", gitCmdInfo.RepoUrl,
			"--gitCommand", gitCmdInfo.GitCommand,
		)
		err = validator.Start()
		if err != nil {
			log.WithError(err).Print("error spawning validator")
			return
		}
		err = validator.Process.Release()
		if err != nil {
			log.WithError(err).Print("error releasing validator")
			return
		}
	},
}

func parseFromStdin() (map[string]string, error) {
	result := make(map[string]string)
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if len(line) > 0 {
			tuple := strings.Split(line, "=")
			if len(tuple) == 2 {
				result[tuple[0]] = strings.TrimSpace(tuple[1])
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return result, nil
}

type gitCommandInfo struct {
	RepoUrl    string
	GitCommand string
}

func (g *gitCommandInfo) Ok() bool {
	return g.RepoUrl != "" && g.GitCommand != ""
}

var gitCommandRegExp = regexp.MustCompile(`git(?:\s+(?:\S+\s+)*)(push|clone|fetch|pull|diff|ls-remote)(?:\s+(?:\S+\s+)*)?`)
var repoUrlRegExp = regexp.MustCompile(`remote-https?\s([^\s]+)\s+(https?:[^\s]+)`)

// This method needs to be called multiple times to fill all the required info
// from different git commands
// For example from first command below the `RepoUrl` will be parsed and from
// the second command the `GitCommand` will be parsed
// `/usr/lib/git-core/git-remote-https origin https://github.com/jeanp413/test-gp-bug.git`
// `/usr/lib/git-core/git push`
func (g *gitCommandInfo) parseGitCommandAndRemote(cmdLineString string) {
	matchCommand := gitCommandRegExp.FindStringSubmatch(cmdLineString)
	if len(matchCommand) == 2 {
		g.GitCommand = matchCommand[1]
	}

	matchRepo := repoUrlRegExp.FindStringSubmatch(cmdLineString)
	if len(matchRepo) == 3 {
		g.RepoUrl = matchRepo[2]
		if !strings.HasSuffix(g.RepoUrl, ".git") {
			g.RepoUrl = g.RepoUrl + ".git"
		}
	}
}

type pidCallbackFn func(procfs.Proc) bool

func walkProcessTree(pid int, fn pidCallbackFn) error {
	for {
		proc, err := procfs.NewProc(pid)
		if err != nil {
			return err
		}

		stop := fn(proc)
		if stop {
			return nil
		}

		procStat, err := proc.Stat()
		if err != nil {
			return err
		}
		if procStat.PPID == pid || procStat.PPID == 1 /* supervisor pid*/ {
			return nil
		}
		pid = procStat.PPID
	}
}

// How to smoke test:
// - Open a public git repository and try pushing some commit with and without permissions in the dashboard, if no permissions a popup should appear in vscode
// - Open a private git repository and try pushing some commit with and without permissions in the dashboard, if no permissions a popup should appear in vscode
// - Private npm package
//   - Create a private git repository for an npm package e.g https://github.com/jeanp413/test-private-package
//   - Start a workspace, then run `npm install github:jeanp413/test-private-package` with and without permissions in the dashboard
// - Private npm package no access
//   - Open this workspace https://github.com/jeanp413/test-gp-bug and run `npm install`
//   - Observe NO notification with this message appears `Unknown repository '' Please grant the necessary permissions.`
// - Clone private repo without permission
//   - Start a workspace, then run `git clone 'https://gitlab.ebizmarts.com/ebizmarts/magento2-pos-api-request.git`, you should see a prompt ask your username and password, instead of `'gp credential-helper' told us to quit`
func init() {
	rootCmd.AddCommand(credentialHelper)
}
