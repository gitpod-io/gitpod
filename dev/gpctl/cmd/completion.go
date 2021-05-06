// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var completionCmd = &cobra.Command{
	Use:   "completion [bash|zsh|fish|powershell]",
	Short: "Generate completion script",
	Long: `To load completions:

Bash:

  $ source <(gpctl completion bash)

  # To load completions for each session, execute once:
  # Linux:
  $ gpctl completion bash > /etc/bash_completion.d/gpctl
  # macOS:
  $ gpctl completion bash > /usr/local/etc/bash_completion.d/gpctl

Zsh:

  # If shell completion is not already enabled in your environment,
  # you will need to enable it.  You can execute the following once:

  $ echo "autoload -U compinit; compinit" >> ~/.zshrc

  # To load completions for each session, execute once:
  $ gpctl completion zsh > "${fpath[1]}/_gpctl"

  # You will need to start a new shell for this setup to take effect.

fish:

  $ gpctl completion fish | source

  # To load completions for each session, execute once:
  $ gpctl completion fish > ~/.config/fish/completions/gpctl.fish

PowerShell:

  PS> gpctl completion powershell | Out-String | Invoke-Expression

  # To load completions for every new session, run:
  PS> gpctl completion powershell > gpctl.ps1
  # and source this file from your PowerShell profile.
`,
	DisableFlagsInUseLine: true,
	ValidArgs:             []string{"bash", "zsh", "fish", "powershell"},
	Args:                  cobra.ExactValidArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		switch args[0] {
		case "bash":
			cmd.Root().GenBashCompletion(os.Stdout)
		case "zsh":
			cmd.Root().GenZshCompletion(os.Stdout)
		case "fish":
			cmd.Root().GenFishCompletion(os.Stdout, true)
		case "powershell":
			cmd.Root().GenPowerShellCompletionWithDesc(os.Stdout)
		}
	},
}

func init() {
	rootCmd.AddCommand(completionCmd)
}
