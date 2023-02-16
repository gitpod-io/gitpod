// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisorapi "github.com/gitpod-io/gitpod/supervisor/api"
)

var exportEnvs = false
var unsetEnvs = false

// envCmd represents the env command
var envCmd = &cobra.Command{
	Use:   "env",
	Short: "Controls workspace environment variables.",
	Long: `This command can print and modify the persistent environment variables associated with your workspace.

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
	RunE: func(cmd *cobra.Command, args []string) error {
		log.SetOutput(io.Discard)
		f, err := os.OpenFile(os.TempDir()+"/gp-env.log", os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
		if err == nil {
			defer f.Close()
			log.SetOutput(f)
		}

		ctx, cancel := context.WithTimeout(cmd.Context(), 1*time.Minute)
		defer cancel()

		if len(args) > 0 {
			if unsetEnvs {
				err = deleteEnvs(ctx, args)
			} else {
				err = setEnvs(ctx, args)
			}
		} else {
			err = getEnvs(ctx)
		}
		return err
	},
}

type connectToServerResult struct {
	repositoryPattern string
	wsInfo            *supervisorapi.WorkspaceInfoResponse
	client            *serverapi.APIoverJSONRPC

	useDeprecatedGetEnvVar bool
}

func connectToServer(ctx context.Context) (*connectToServerResult, error) {
	supervisorClient, err := supervisor.New(ctx)
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	defer supervisorClient.Close()

	wsinfo, err := supervisorClient.Info.WorkspaceInfo(ctx, &supervisorapi.WorkspaceInfoRequest{})
	if err != nil {
		return nil, xerrors.Errorf("failed getting workspace info from supervisor: %w", err)
	}
	if wsinfo.Repository == nil {
		return nil, xerrors.New("workspace info is missing repository")
	}
	if wsinfo.Repository.Owner == "" {
		return nil, xerrors.New("repository info is missing owner")
	}
	if wsinfo.Repository.Name == "" {
		return nil, xerrors.New("repository info is missing name")
	}
	repositoryPattern := wsinfo.Repository.Owner + "/" + wsinfo.Repository.Name

	var useDeprecatedGetEnvVar bool
	clientToken, err := supervisorClient.Token.GetToken(ctx, &supervisorapi.GetTokenRequest{
		Host: wsinfo.GitpodApi.Host,
		Kind: "gitpod",
		Scope: []string{
			"function:getWorkspaceEnvVars",
			"function:setEnvVar",
			"function:deleteEnvVar",
			"resource:envVar::" + repositoryPattern + "::create/get/update/delete",
		},
	})
	if err != nil {
		// TODO remove then GetWorkspaceEnvVars is deployed
		clientToken, err = supervisorClient.Token.GetToken(ctx, &supervisorapi.GetTokenRequest{
			Host: wsinfo.GitpodApi.Host,
			Kind: "gitpod",
			Scope: []string{
				"function:getEnvVars", // TODO remove then getWorkspaceEnvVars is deployed
				"function:setEnvVar",
				"function:deleteEnvVar",
				"resource:envVar::" + repositoryPattern + "::create/get/update/delete",
			},
		})
		useDeprecatedGetEnvVar = true
	}
	if err != nil {
		return nil, xerrors.Errorf("failed getting token from supervisor: %w", err)
	}
	client, err := serverapi.ConnectToServer(wsinfo.GitpodApi.Endpoint, serverapi.ConnectToServerOpts{
		Token:   clientToken.Token,
		Context: ctx,
		Log:     log.NewEntry(log.StandardLogger()),
	})
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to server: %w", err)
	}
	return &connectToServerResult{repositoryPattern, wsinfo, client, useDeprecatedGetEnvVar}, nil
}

func getEnvs(ctx context.Context) error {
	result, err := connectToServer(ctx)
	if err != nil {
		return err
	}
	defer result.client.Close()

	var vars []*serverapi.EnvVar
	if !result.useDeprecatedGetEnvVar {
		vars, err = result.client.GetWorkspaceEnvVars(ctx, result.wsInfo.WorkspaceId)
	} else {
		vars, err = result.client.GetEnvVars(ctx)
	}
	if err != nil {
		return xerrors.Errorf("failed to fetch env vars from server: %w", err)
	}

	for _, v := range vars {
		printVar(v.Name, v.Value, exportEnvs)
	}

	return nil
}

func setEnvs(ctx context.Context, args []string) error {
	result, err := connectToServer(ctx)
	if err != nil {
		return err
	}
	defer result.client.Close()

	vars, err := parseArgs(args, result.repositoryPattern)
	if err != nil {
		return err
	}

	g, ctx := errgroup.WithContext(ctx)
	for _, v := range vars {
		v := v
		g.Go(func() error {
			err = result.client.SetEnvVar(ctx, v)
			if err != nil {
				return err
			}
			printVar(v.Name, v.Value, exportEnvs)
			return nil
		})
	}
	return g.Wait()
}

func deleteEnvs(ctx context.Context, args []string) error {
	result, err := connectToServer(ctx)
	if err != nil {
		return err
	}
	defer result.client.Close()

	g, ctx := errgroup.WithContext(ctx)
	var wg sync.WaitGroup
	wg.Add(len(args))
	for _, name := range args {
		name := name
		g.Go(func() error {
			return result.client.DeleteEnvVar(ctx, &serverapi.UserEnvVarValue{Name: name, RepositoryPattern: result.repositoryPattern})
		})
	}
	return g.Wait()
}

func printVar(name string, value string, export bool) {
	val := strings.Replace(value, "\"", "\\\"", -1)
	if export {
		fmt.Printf("export %s=\"%s\"\n", name, val)
	} else {
		fmt.Printf("%s=%s\n", name, val)
	}
}

func parseArgs(args []string, pattern string) ([]*serverapi.UserEnvVarValue, error) {
	vars := make([]*serverapi.UserEnvVarValue, len(args))
	for i, arg := range args {
		kv := strings.SplitN(arg, "=", 1)
		if len(kv) != 1 || kv[0] == "" {
			return nil, xerrors.Errorf("empty string (correct format is key=value)")
		}

		if !strings.Contains(kv[0], "=") {
			return nil, xerrors.Errorf("%s has no equal character (correct format is %s=some_value)", arg, arg)
		}

		parts := strings.SplitN(kv[0], "=", 2)

		key := strings.TrimSpace(parts[0])
		if key == "" {
			return nil, xerrors.Errorf("variable must have a name")
		}

		// Do not trim value - the user might want whitespace here
		// Also do not check if the value is empty, as an empty value means we want to delete the variable
		val := parts[1]
		// the value could be defined with known separators
		val = strings.Trim(val, `"`)
		val = strings.Trim(val, `'`)
		val = strings.ReplaceAll(val, `\ `, " ")

		if val == "" {
			return nil, xerrors.Errorf("variable must have a value; use -u to unset a variable")
		}

		vars[i] = &serverapi.UserEnvVarValue{Name: key, Value: val, RepositoryPattern: pattern}
	}

	return vars, nil
}

func init() {
	rootCmd.AddCommand(envCmd)

	envCmd.Flags().BoolVarP(&exportEnvs, "export", "e", false, "produce a script that can be eval'ed in Bash")
	envCmd.Flags().BoolVarP(&unsetEnvs, "unset", "u", false, "deletes/unsets persisted environment variables")
}
