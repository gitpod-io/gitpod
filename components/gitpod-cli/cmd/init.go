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
			d = []byte(`# List the start up tasks. Learn more https://www.gitpod.io/docs/config-start-tasks/
tasks:
  - init: echo 'init script' # runs during prebuild
    command: echo 'start script'

# List the ports to expose. Learn more https://www.gitpod.io/docs/config-ports/
ports:
  - port: 3000
    onOpen: open-preview
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
# More information: https://www.gitpod.io/docs/config-docker/
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
