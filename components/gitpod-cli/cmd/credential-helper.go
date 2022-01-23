// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

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
			// token was not found, thus we return just a dummy to satisfy the git protocol
			if user == "" {
				user = "oauth2"
			}
			if token == "" {
				token = "no"
			}
			fmt.Printf("username=%s\npassword=%s\n", user, token)
		}()

		repoURL, gitCommand := parseProcessTree()

		// Starts another process which tracks the executed git event
		gitCommandTracker := exec.Command("/proc/self/exe", "git-track-command", "--gitCommand", gitCommand)
		err = gitCommandTracker.Start()
		if err != nil {
			log.WithError(err).Print("error spawning tracker")
		} else {
			err = gitCommandTracker.Process.Release()
			if err != nil {
				log.WithError(err).Print("error releasing tracker")
			}
		}

		host := parseHostFromStdin()
		if len(host) == 0 {
			log.Println("'host' is missing")
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

func parseProcessTree() (repoUrl string, gitCommand string) {
	gitCommandRegExp := regexp.MustCompile(`git(,\d+\s+|\s+)(push|clone|fetch|pull|diff)`)
	repoUrlRegExp := regexp.MustCompile(`\sorigin\s*(https:[^\s]*)\s`)
	pid := os.Getpid()
	for {
		cmdLine := readProc(pid, "cmdline")
		if cmdLine == "" {
			return
		}
		cmdLineString := strings.ReplaceAll(cmdLine, string(byte(0)), " ")
		log.Printf("Command line pid %v: '%s'", pid, cmdLineString)
		if gitCommand == "" {
			match := gitCommandRegExp.FindStringSubmatch(cmdLineString)
			if len(match) == 3 {
				gitCommand = match[2]
			}
		}
		if repoUrl == "" {
			match := repoUrlRegExp.FindStringSubmatch(cmdLineString)
			if len(match) == 2 {
				repoUrl = match[1]
				if !strings.HasSuffix(repoUrl, ".git") {
					repoUrl = repoUrl + ".git"
				}
			}
		}
		if repoUrl != "" && gitCommand != "" {
			return
		}
		statsString := readProc(pid, "stat")
		if statsString == "" {
			return
		}
		stats := strings.Fields(statsString)
		if len(stats) < 3 {
			log.Printf("Couldn't parse 3rd element from stats: '%s'", statsString)
			return
		}
		ppid, err := strconv.Atoi(stats[3])
		if err != nil {
			log.Printf("ppid '%s' is not a number", stats[3])
			return
		}
		log.Printf("Parent pid: %v - %v", pid, ppid)
		if ppid == pid {
			return
		}
		pid = ppid
	}
}

func readProc(pid int, file string) string {
	procFile := fmt.Sprintf("/proc/%d/%s", pid, file)
	// read file not using os.Stat
	// see https://github.com/prometheus/procfs/blob/5162bec877a860b5ff140b5d13db31ebb0643dd3/internal/util/readfile.go#L27
	const maxBufferSize = 1024 * 512
	f, err := os.Open(procFile)
	if err != nil {
		log.WithError(err).Printf("Error opening %s", procFile)
		return ""
	}
	defer f.Close()
	reader := io.LimitReader(f, maxBufferSize)
	buffer, err := ioutil.ReadAll(reader)
	if err != nil {
		log.WithError(err).Printf("Error reading %s", procFile)
		return ""
	}
	return string(buffer)
}

func init() {
	rootCmd.AddCommand(credentialHelper)
}
