// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/theialib"
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
			// token was not found, thus we return just a dummy to satisfy the git protocol
			if user == "" {
				user = "oauth2"
			}
			if token == "" {
				token = "no"
			}
			fmt.Printf("username=%s\npassword=%s\n", user, token)
		}()

		repoURL, gitCommand := parsePstree()
		host := parseHostFromStdin()
		if len(host) == 0 {
			log.Println("'host' is missing")
		}

		if isTheiaIDE() {
			service, err := theialib.NewServiceFromEnv()
			if err != nil {
				log.WithError(err).Print("cannot connect to Theia")
				return
			}
			if action == "get" {
				resp, err := service.GetGitToken(theialib.GetGitTokenRequest{
					Command: gitCommand,
					Host:    host,
					RepoURL: repoURL,
				})
				if err != nil {
					log.WithError(err).Print("cannot get token")
					return
				}
				user = resp.User
				token = resp.Token
			}
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

		validator := exec.Command("/proc/self/exe", "git-token-validator",
			"--user", resp.User, "--token", resp.Token, "--scopes", strings.Join(resp.Scope, ","),
			"--host", host, "--repoURL", repoURL, "--gitCommand", gitCommand)
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
		user = resp.User
		token = resp.Token
	},
}

func isTheiaIDE() bool {
	stat, err := os.Stat("/theia")
	return !errors.Is(os.ErrNotExist, err) && stat != nil && stat.IsDir()
}

func parseHostFromStdin() string {
	host := ""
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
	if err := scanner.Err(); err != nil {
		log.Println(err)
	}
	return host
}

func logDebug(v ...interface{}) {
	if os.Getenv("CREDENTIAL_HELPER_DEBUG_LOG") == "true" {
		log.Println(v...)
	}
}

func parsePstree() (string, string) {
	url := ""
	gitCommand := ""
	cmd := exec.Command("pstree", "-sa", strconv.Itoa(os.Getpid()))
	msg, err := cmd.CombinedOutput()
	if err != nil {
		log.Println(err)
	} else {
		pstree := string(msg)
		logDebug("debug> pstree: ")
		logDebug(pstree)

		// git command
		re := regexp.MustCompile("git(,\\d+\\s+|\\s+)(push|clone|fetch|pull|diff)")
		match := re.FindStringSubmatch(pstree)
		if len(match) == 3 {
			gitCommand = match[2]
		}

		// url
		re = regexp.MustCompile("origin\\s*(https:.*\\.git)\\n")
		match = re.FindStringSubmatch(pstree)
		if len(match) == 2 {
			url = match[1]
		}
	}
	return url, gitCommand
}

func init() {
	rootCmd.AddCommand(credentialHelper)
}
