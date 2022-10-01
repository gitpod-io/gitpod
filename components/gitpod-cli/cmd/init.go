// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
	yaml "gopkg.in/yaml.v2"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpodlib"
)

var (
	interactive = false
)

// initCmd initializes the workspace's .gitpod.yml file
var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Create a Gitpod configuration for this project.",
	Long: `
Create a Gitpod configuration for this project.
	`,
	Run: func(cmd *cobra.Command, args []string) {
		cfg := gitpodlib.GitpodFile{}
		if interactive {
			if err := askForDockerImage(&cfg); err != nil {
				log.Fatal(err)
			}
			if err := askForPorts(&cfg); err != nil {
				log.Fatal(err)
			}
			if err := askForTask(&cfg); err != nil {
				log.Fatal(err)
			}
		} else {
			cfg.AddPort(3000)
			cfg.AddTask("echo 'start script'", "echo 'init script'")
		}

		d, err := yaml.Marshal(cfg)
		if err != nil {
			log.Fatal(err)
		}
		if !interactive {
			d = []byte(`## Learn more about this file at 'https://www.gitpod.io/docs/references/gitpod-yml'

## This '.gitpod.yml' file when placed at the root of a project instructs
## Gitpod how to prepare & build the project, start development environments
## and configure continuous prebuilds. Prebuilds when enabled builds a project
## like a CI server so you can start coding right away - no more waiting for
## dependencies to download and builds to finish when reviewing pull-requests
## or hacking on something new.

## With Gitpod you can develop software from any device (even iPads) via
## desktop or browser based versions of VS Code or any JetBrains IDE and
## customise it to your individual needs - from themes to extensions, you
## have full control.

## The easiest way to try out Gitpod is install the browser extenion:
## 'https://www.gitpod.io/docs/configure/user-settings/browser-extension' or by prefixing
## 'https://gitpod.io#' to the source control URL of any project.
##
## For example: 'https://gitpod.io#https://github.com/gitpod-io/gitpod'

## The 'image' section defines which Docker image Gitpod should use.
## By default, Gitpod uses a standard Docker Image called 'workspace-full'
## which can be found at 'https://github.com/gitpod-io/workspace-images'

## Workspaces started based on this default image come pre-installed with
## Docker, Go, Java, Node.js, C/C++, Python, Ruby, Rust, PHP as well as
## tools such as Homebrew, Tailscale, Nginx and several more.

## If this image does not include the tools needed for your project then
## a public Docker image or your own Docker file can be configured.
##
## Learn more about images at 'https://www.gitpod.io/docs/configure/workspaces/workspace-image'

#image: node:buster                        # use 'https://hub.docker.com/_/node'
#
#image:                                    # leave image undefined if using a Dockerfile
#  file: .gitpod.Dockerfile                # relative path to the Dockerfile from the
#                                          # root of the project

## The 'tasks' section defines how Gitpod prepares and builds this project
## or how Gitpod can start development servers. With Gitpod, there are three
## types of tasks:

## - before: Use this for tasks that need to run before init and before command.
## - init: Use this to configure prebuilds of heavy-lifting tasks such as
##         downloading dependencies or compiling source code.
## - command: Use this to start your database or application when the workspace starts.

## Learn more about these tasks at 'https://www.gitpod.io/docs/configure/workspaces/tasks'

#tasks:
#  - before: |
#      # commands to execute...
#
#  - init: |
#      # sudo apt-get install python3     # can be used to install operating system
#                                         # dependencies but these are not kept after the
#                                         # prebuild completes thus Gitpod recommends moving
#                                         # operating system dependency installation steps
#                                         # to a custom Dockerfile to make prebuilds faster
#                                         # and to keep your codebase DRY.
#                                         # 'https://www.gitpod.io/docs/configure/workspaces/workspace-image'
#
#      # pip install -r requirements.txt  # install codebase dependencies
#      # cmake                            # precompile codebase
#
#  - name: Web Server
#    openMode: split-left
#    env:
#      WEBSERVER_PORT: 8080
#    command: |
#     python3 -m http.server $WEBSERVER_PORT
#
#  - name: Web Browser
#    openMode: split-right
#    env:
#      WEBSERVER_PORT: 8080
#    command: |
#     gp await-port $WEBSERVER_PORT

## The 'ports' section defines various ports your may listen on are
## configured in Gitpod on an authenticated URL. By default, all ports
## are in private visibility state.

## Learn more about ports at 'https://www.gitpod.io/docs/configure/workspaces/ports'

#ports:
#  - port: 8080 # alternatively configure entire ranges via '8080-8090'
#    visibility: private # either 'public' or 'private' (default)
#    onOpen: open-browser # either 'open-browser', 'open-preview' or 'ignore'

## The 'vscode' section defines a list of Visual Studio Code extensions from
## the OpenVSX.org registry to be installed upon workspace startup. OpenVSX
## is an open alternative to the proprietary Visual Studio Code Marketplace
## and extensions can be added by sending a pull-request with the extension
## identifier to https://github.com/open-vsx/publish-extensions

## The identifier of an extension is always ${publisher}.${name}.

## For example: 'vscodevim.vim'

## Learn more at 'https://www.gitpod.io/docs/references/ides-and-editors/vscode'

#vscode:
#  extensions:
#    - vscodevim.vim
#    - esbenp.prettier-vscode@9.5.0
#    - https://example.com/abc/releases/extension-0.26.0.vsix

## The 'github' section defines configuration of continuous prebuilds
## for GitHub repositories when the GitHub application
## 'https://github.com/apps/gitpod-io' is installed in GitHub and granted
## permissions to access the repository.

## Learn more at 'https://www.gitpod.io/docs/configure/projects/prebuilds'

github:
prebuilds:
# enable for the default branch
master: true
# enable for all branches in this repo
branches: true
# enable for pull requests coming from this repo
pullRequests: true
# enable for pull requests coming from forks
pullRequestsFromForks: true
# add a check to pull requests
addCheck: true
# add a "Review in Gitpod" button as a comment to pull requests
addComment: false
# add a "Review in Gitpod" button to the pull request's description
addBadge: true

`)
		} else {
			fmt.Printf("\n\n---\n%s", d)
		}

		if _, err := os.Stat(".gitpod.yml"); err == nil {
			prompt := promptui.Prompt{
				IsConfirm: true,
				Label:     ".gitpod.yml file already exists, overwrite?",
			}
			if _, err := prompt.Run(); err != nil {
				fmt.Printf("Not overwriting .gitpod.yml file. Aborting.\n")
				os.Exit(1)
				return
			}
		}

		if err := os.WriteFile(".gitpod.yml", d, 0644); err != nil {
			log.Fatal(err)
		}

		// open .gitpod.yml and Dockerfile
		if v, ok := cfg.Image.(gitpodlib.GitpodImage); ok {
			if _, err := os.Stat(v.File); os.IsNotExist(err) {
				if err := os.WriteFile(v.File, []byte(`FROM gitpod/workspace-full

USER gitpod

# Install custom tools, runtime, etc. using apt-get
# For example, the command below would install "bastet" - a command line tetris clone:
#
# RUN sudo apt-get -q update && \
#     sudo apt-get install -yq bastet && \
#     sudo rm -rf /var/lib/apt/lists/*
#
# More information: https://www.gitpod.io/docs/configure/workspaces/workspace-image
`), 0644); err != nil {
					log.Fatal(err)
				}
			}

			openCmd.Run(cmd, []string{v.File})
		}
		openCmd.Run(cmd, []string{".gitpod.yml"})
	},
}

func isRequired(input string) error {
	if input == "" {
		return errors.New("Cannot be empty")
	}
	return nil
}

func ask(lbl string, def string, validator promptui.ValidateFunc) (string, error) {
	scslbl := strings.Trim(strings.Split(lbl, "(")[0], " ")
	prompt := promptui.Prompt{
		Label:    lbl,
		Validate: validator,
		Default:  def,
		Templates: &promptui.PromptTemplates{
			Success: fmt.Sprintf("%s: ", scslbl),
		},
	}
	return prompt.Run()
}

func askForDockerImage(cfg *gitpodlib.GitpodFile) error {
	prompt := promptui.Select{
		Label: "Workspace Docker image",
		Items: []string{"default", "custom image", "docker file"},
		Templates: &promptui.SelectTemplates{
			Selected: "Workspace Image: {{ . }}",
		},
	}
	chce, _, err := prompt.Run()
	if err != nil {
		return err
	}

	if chce == 0 {
		return nil
	}
	if chce == 1 {
		nme, err := ask("Image name", "", isRequired)
		if err != nil {
			return err
		}
		cfg.SetImageName(nme)
		return nil
	}

	// configure docker file
	dockerFile, err := ask("Dockerfile path", ".gitpod.Dockerfile", isRequired)
	if err != nil {
		return err
	}
	ctxtPath, err := ask("Docker context path (enter to skip)", "", nil)
	if err != nil {
		return err
	}
	cfg.SetImage(gitpodlib.GitpodImage{
		File:    dockerFile,
		Context: ctxtPath,
	})
	return nil
}

func parsePorts(input string) ([]int32, error) {
	if input == "" {
		return []int32{}, nil
	}
	prts := strings.Split(input, ",")
	rst := make([]int32, 0)
	for _, prt := range prts {
		if pv, err := strconv.ParseUint(strings.TrimSpace(prt), 10, 16); err != nil {
			return nil, err
		} else {
			rst = append(rst, int32(pv))
		}
	}
	return rst, nil
}

func askForPorts(cfg *gitpodlib.GitpodFile) error {
	input, err := ask("Expose Ports (comma separated)", "", func(input string) error {
		if _, err := parsePorts(input); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}

	prts, err := parsePorts(input)
	if err != nil {
		return err
	}

	for _, pv := range prts {
		cfg.AddPort(pv)
	}
	return nil
}

func askForTask(cfg *gitpodlib.GitpodFile) error {
	input, err := ask("Startup task (enter to skip)", "", nil)
	if err != nil {
		return err
	}
	if input != "" {
		cfg.AddTask(input)
	}

	return nil
}

func init() {
	rootCmd.AddCommand(initCmd)
	initCmd.Flags().BoolVarP(&interactive, "interactive", "i", false, "walk me through an interactive setup.")
}
