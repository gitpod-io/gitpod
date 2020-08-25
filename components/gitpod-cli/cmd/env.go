// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/theialib"
	"github.com/spf13/cobra"
)

var exportEnvs = false
var unsetEnvs = false

// envCmd represents the env command
var envCmd = &cobra.Command{
	Use:   "env",
	Short: "Controls user-defined, persistent environment variables.",
	Long: `This command can print and modify the persistent environment variables associated with your user, for this repository.

To set the persistent environment variable 'foo' to the value 'bar' use:
	gp env foo=bar

Beware that this does not modify your current terminal session, but rather persists this variable for the next workspace on this repository.
This command can only interact with environment variables for this repository. If you want to set that environment variable in your terminal,
you can do so using -e:
	eval $(gp env -e foo=bar)

To update the current terminal session with the latest set of persistent environment variables, use:
    eval $(gp env -e)

To delete a persistent environment variable use:
	gp env -u foo

Note that you can delete/unset variables if their repository pattern matches the repository of this workspace exactly. I.e. you cannot
delete environment variables with a repository pattern of */foo, foo/* or */*.
`,
	Args: cobra.ArbitraryArgs,
	Run: func(cmd *cobra.Command, args []string) {
		fail := func(msg string) {
			fmt.Fprintln(os.Stderr, msg)
			os.Exit(-1)
		}

		service, err := theialib.NewServiceFromEnv()
		if err != nil {
			fail(err.Error())
		}

		setEnvs := func() {
			vars := make([]theialib.EnvironmentVariable, len(args))
			for i, arg := range args {
				kv := strings.Split(arg, "=")
				if len(kv) != 2 {
					fail(fmt.Sprintf("%s has no value (correct format is %s=some_value)", arg, arg))
				}

				key := strings.TrimSpace(kv[0])
				if key == "" {
					fail(fmt.Sprintf("variable must have a name"))
				}
				// Do not trim value - the user might want whitespace here
				// Also do not check if the value is empty, as an empty value means we want to delete the variable
				val := kv[1]
				if val == "" {
					fail(fmt.Sprintf("variable must have a value; use -u to unset a variable"))
				}

				vars[i] = theialib.EnvironmentVariable{Name: key, Value: val}
			}

			_, err = service.SetEnvVar(theialib.SetEnvvarRequest{Variables: vars})
			if err != nil {
				fail(fmt.Sprintf("cannot set environment variables: %v", err))
			}

			for _, v := range vars {
				printVar(v, exportEnvs)
			}
		}
		getEnvs := func() {
			vars, err := service.GetEnvVars(theialib.GetEnvvarsRequest{})
			if err != nil {
				fail(fmt.Sprintf("cannot get environment variables: %v", err))
			}

			for _, v := range vars.Variables {
				printVar(v, exportEnvs)
			}
		}
		doUnsetEnvs := func() {
			resp, err := service.DeleteEnvVar(theialib.DeleteEnvvarRequest{Variables: args})
			if err != nil {
				fail(fmt.Sprintf("cannot unset environment variables: %v", err))
			}

			if len(resp.NotDeleted) != 0 {
				fail(fmt.Sprintf("cannot unset environment variables: %s", strings.Join(resp.NotDeleted, ", ")))
			}
		}

		if len(args) > 0 {
			if unsetEnvs {
				doUnsetEnvs()
				return
			}

			setEnvs()
		} else {
			getEnvs()
		}
	},
}

func printVar(v theialib.EnvironmentVariable, export bool) {
	val := strings.Replace(v.Value, "\"", "\\\"", -1)
	if export {
		fmt.Printf("export %s=\"%s\"\n", v.Name, val)
	} else {
		fmt.Printf("%s=%s\n", v.Name, val)
	}
}

func init() {
	rootCmd.AddCommand(envCmd)

	envCmd.Flags().BoolVarP(&exportEnvs, "export", "e", false, "produce a script that can be eval'ed in Bash")
	envCmd.Flags().BoolVarP(&unsetEnvs, "unset", "u", false, "deletes/unsets persisted environment variables")
}
