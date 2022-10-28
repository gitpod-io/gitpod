// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"log"
	"os"

	"github.com/spf13/cobra"
)

// completionCmd represents the completion command
var completionCmd = &cobra.Command{
	Use:   "completion",
	Short: "Generates shell completion",
	Long: fmt.Sprintf(`Bash:

	$ source <(%[1]s completion bash)

	# To load completions for each session, execute once:
	$ %[1]s completion bash | sudo tee /etc/bash_completion.d/%[1]s

fish:

	$ %[1]s completion fish | source

	# To load completions for each session, execute once:
	$ mkdir -p ~/.config/fish/completions && %[1]s completion fish > ~/.config/fish/completions/%[1]s.fish

Zsh:

	# If shell completion is not already enabled in your environment,
	# you will need to enable it.  You can execute the following once:
	$ echo "autoload -U compinit; compinit" >> ~/.zshrc

	# To load completions for each session, execute once:
	$ echo "%[1]s completion zsh" | sudo tee "${fpath[1]}/_%[1]s"

	# You will need to start a new shell for this setup to take effect.
`, rootCmd.Root().Name()),
	ValidArgs: []string{"bash", "fish", "zsh"},
	Args:      cobra.ExactValidArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		switch args[0] {
		case "bash":
			if err := cmd.Root().GenBashCompletion(os.Stdout); err != nil {
				err_log("bash")
			}
		case "fish":
			if err := cmd.Root().GenFishCompletion(os.Stdout, true); err != nil {
				err_log("fish")
			}
		case "zsh":
			if err := cmd.Root().GenZshCompletion(os.Stdout); err != nil {
				err_log("zsh")
			}
		}
	},
}

func err_log(shell string) {
	log.Fatalf("Failed to generate completion for %s", shell)
}

func init() {
	rootCmd.AddCommand(completionCmd)
}
