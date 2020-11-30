// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

//go:generate sh -c "cd .. && echo \\# generated using go generate in components/gpctl > ../../devops/images/workspaces/gitpod-dev/gpctl_completion; go run main.go completion bash >> ../../devops/images/workspaces/gitpod-dev/gpctl_completion"

import (
	"os"

	"github.com/spf13/cobra"
)

const (
	bashCompletionFunc = `__gpctl_parse_get_workspace_url()
{
    local gpctl_output out
    if gpctl_output=$(gpctl workspaces list --output-template '{{ range .Status }}{{ .Id }} {{ .Spec.Url | trimPrefix "http://" | trimPrefix "https://" }} {{ end }}' | tr " " "\n" 2>/dev/null); then
        out=($(echo "${gpctl_output}" | awk '{print $1}'))
        COMPREPLY=( $( compgen -W "${out[*]}" -- "$cur" ) )
    fi
}
__gpctl_get_workspace_url()
{
    __gpctl_parse_get_workspace_url
    if [[ $? -eq 0 ]]; then
        return 0
    fi
}
__gpctl_parse_get_imagebuild_ref()
{
	local gpctl_output out
    if gpctl_output=$(gpctl imagebuilds list -o jsonpath | tr " " "\n" 2>/dev/null); then
        out=($(echo "${gpctl_output}" | awk '{print $1}'))
        COMPREPLY=( $( compgen -W "${out[*]}" -- "$cur" ) )
    fi
}
__gpctl_get_imagebuild_ref()
{
	__gpctl_parse_get_imagebuild_ref
    if [[ $? -eq 0 ]]; then
        return 0
    fi
}
__gpctl_custom_func() {
    case ${last_command} in
        gpctl_workspaces_describe | gpctl_workspaces_stop | gpctl_workspaces_snapshot)
            __gpctl_get_workspace_url
            return
			;;
		gpctl_imagebuilds_logs)
            __gpctl_get_imagebuild_ref
            return
            ;;
        *)
            ;;
    esac
}
`
)

// bashCompletionCmd represents the bashCompletion command
var bashCompletionCmd = &cobra.Command{
	Use:       "completion bash|zsh",
	Short:     "Provides shell completion for gpctl. Use with `. <(gpctl completion)`",
	Hidden:    true,
	Args:      cobra.ExactValidArgs(1),
	ValidArgs: []string{"bash", "zsh"},
	Run: func(cmd *cobra.Command, args []string) {
		switch args[0] {
		case "bash":
			rootCmd.GenBashCompletion(os.Stdout)
		case "zsh":
			rootCmd.GenZshCompletion(os.Stdout)
		}
	},
}

func init() {
	rootCmd.AddCommand(bashCompletionCmd)
}
