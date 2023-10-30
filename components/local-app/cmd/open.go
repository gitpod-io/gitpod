// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	git "github.com/go-git/go-git/v5"
	"github.com/toqueteos/webbrowser"
)

// openWorkspaceFromLocalRepositoryCommand opens a local repository in Gitpod
var openWorkspaceFromLocalRepositoryCommand = &cobra.Command{
	Use:    "open",
	Short:  "Opens a local repository in Gitpod",
	Hidden: true,
	Long: `Opens a local repository in Gitpod, turning your local development environment into a cloud-based one.

This command inspects the Git repository in the specified directory, or the current directory if none is specified. It retrieves the URL of all the remote repositories associated with the local repo.

If there is only one remote URL, the command will open the Gitpod workspace directly using this URL. If there are multiple remote URLs, the command will ask you to select the one you want to use. If there are no remote URLs, the command will fail with an error.

The command works with a Gitpod host that can be specified in the configuration (configuration field "host"). It constructs the URL for the Gitpod workspace based on this host and the selected remote URL. The command opens this URL in your default web browser, thus starting the Gitpod workspace.
`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		log.SetFlags(0)

		folder := "."
		if len(args) > 0 {
			folder = args[0]
		}

		_, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		repo, err := git.PlainOpen(folder) // open the repo in the specified directory
		if err != nil {
			log.Fatal(err)
		}

		remotes, err := repo.Remotes()
		if err != nil {
			log.Fatal(err)
		}

		var urls []string
		for _, remote := range remotes {
			urls = append(urls, remote.Config().URLs...)
		}

		var repoURL string
		if len(urls) == 1 {
			repoURL = urls[0]
		} else if len(urls) > 1 {
			prompt := promptui.Select{
				Label: "Select Git Remote URL",
				Items: urls,
			}

			_, url, err := prompt.Run()
			if err != nil {
				log.Fatalf("Prompt failed %v\n", err)
			}

			repoURL = url
		} else {
			log.Fatal("No remote URLs found")
		}

		gitpodHost := viper.GetString("host")

		if !strings.HasPrefix(gitpodHost, "http://") && !strings.HasPrefix(gitpodHost, "https://") {
			gitpodHost = "https://" + gitpodHost
		}

		u, err := url.Parse(gitpodHost)
		if err != nil {
			log.Fatal(err)
		}
		u.Fragment = repoURL
		safeURL := u.String()

		fmt.Println("Opening URL:", safeURL)

		if err := webbrowser.Open(safeURL); err != nil {
			log.Fatal(err)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(openWorkspaceFromLocalRepositoryCommand)
}
