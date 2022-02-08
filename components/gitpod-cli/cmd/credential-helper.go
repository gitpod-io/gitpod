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

		var user, token string
		defer func() {
			// Credentials not found, return `quit=true` so no further helpers will be consulted, nor will the user be prompted.
			// From https://git-scm.com/docs/gitcredentials#_custom_helpers
			if token == "" {
				fmt.Print("quit=true\n")
				return
			}
			// Server could return only the token and not the username, so we fallback to hardcoded `oauth2` username.
			// See https://github.com/gitpod-io/gitpod/pull/7889#discussion_r801670957
			if user == "" {
				user = "oauth2"
			}
			fmt.Printf("username=%s\npassword=%s\n", user, token)
		}()

		host, err := parseHostFromStdin()
		if err != nil {
			log.WithError(err).Print("error parsing 'host' from stdin")
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
		defer cancel()

		supervisorAddr := os.Getenv("SUPERVISOR_ADDR")
		if supervisorAddr == "" {
			supervisorAddr = "localhost:22999"
		}
		supervisorConn, err := grpc.Dial(supervisorAddr, grpc.WithInsecure())
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

func parseHostFromStdin() (host string, err error) {
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if len(line) > 0 {
			tuple := strings.Split(line, "=")
			if len(tuple) == 2 {
				if strings.TrimSpace(tuple[0]) == "host" {
					host = strings.TrimSpace(tuple[1])
				}
			}
		}
	}

	err = scanner.Err()
	if err != nil {
		err = fmt.Errorf("parseHostFromStdin error: %v", err)
	} else if host == "" {
		err = fmt.Errorf("parseHostFromStdin error 'host' is missing")
	}
	return
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
func init() {
	rootCmd.AddCommand(credentialHelper)
}
