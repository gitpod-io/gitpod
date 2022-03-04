// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
// Based on https://github.com/leodido/rn2md with kind permission from the author
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/google/go-github/v38/github"
	"github.com/spf13/cobra"
	"golang.org/x/oauth2"
)

func main() {
	if err := rootCommand.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

var rootCommand = &cobra.Command{
	Use:   "changelog",
	Long:  "Little configurable CLI create/update/push the markdown for your changelogs from release-note blocks found into your project pull requests.",
	Short: "Automate changelog generation from release-note blocks.",
}

func NewClient(token string) *github.Client {
	client := github.NewClient(nil)

	// Eventually create an authenticated client
	if token != "" {
		ts := oauth2.StaticTokenSource(
			&oauth2.Token{AccessToken: token},
		)
		tc := oauth2.NewClient(context.Background(), ts)
		client = github.NewClient(tc)
	}
	return client
}
