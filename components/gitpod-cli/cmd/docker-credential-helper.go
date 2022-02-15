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
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"

	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

var dockerCredentialHelper = &cobra.Command{
	Use:    "docker-credential-helper get",
	Short:  "Gitpod Credential Helper for docker",
	Long:   "Supports reading of credentials per host.",
	Args:   cobra.MinimumNArgs(1),
	Hidden: true,
	Run: func(cmd *cobra.Command, args []string) {
		action := args[0]
		log.SetOutput(io.Discard)
		f, err := os.OpenFile(os.TempDir()+"/gitpod-docker-credential-helper.log", os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
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
			log.Print(token)
			fmt.Printf("{ \"Username\": \"%s\", \"Secret\": \"%s\"}", user, token)
		}()

		host, err := parseRegistryHostFromStdin()
		if err != nil {
			log.WithError(err).Print("error parsing 'host' from stdin")
			return
		}
		if host == "registry.gitlab.com" {
			host = "gitlab.com"
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
			Host:  host,
			Scope: []string{"api"},
			Kind:  "git",
		})
		if err != nil {
			log.WithError(err).Print("error getting token from supervisior")
			return
		}

		user = resp.User
		token = resp.Token
	},
}

func parseRegistryHostFromStdin() (host string, err error) {
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if len(line) > 0 {
			host = line
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

func init() {
	rootCmd.AddCommand(dockerCredentialHelper)
}
