// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	log "github.com/sirupsen/logrus"
	"github.com/sourcegraph/jsonrpc2"
	"github.com/spf13/cobra"
	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/supervisor/api"
	supervisorapi "github.com/gitpod-io/gitpod/supervisor/api"
)

var exportEnvs = false
var unsetEnvs = false
var scope = string(envScopeRepo)

type envScope string

var (
	envScopeRepo envScope = "repo"
	envScopeUser envScope = "user"
)

func envScopeFromString(s string) envScope {
	switch s {
	case string(envScopeRepo):
		return envScopeRepo
	case string(envScopeUser):
		return envScopeUser
	default:
		return envScopeRepo
	}
}

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
				setEnvScope := envScopeFromString(scope)
				err = setEnvs(ctx, setEnvScope, args)
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
	gitpodHost        string
}

type connectToServerOptions struct {
	supervisorClient *supervisor.SupervisorClient
	wsInfo           *api.WorkspaceInfoResponse
	log              *log.Entry

	setEnvScope envScope
}

func connectToServer(ctx context.Context, options *connectToServerOptions) (*connectToServerResult, error) {
	var err error
	var supervisorClient *supervisor.SupervisorClient
	if options != nil && options.supervisorClient != nil {
		supervisorClient = options.supervisorClient
	} else {
		supervisorClient, err = supervisor.New(ctx)
		if err != nil {
			return nil, xerrors.Errorf("failed connecting to supervisor: %w", err)
		}
		defer supervisorClient.Close()
	}

	var wsinfo *api.WorkspaceInfoResponse
	if options != nil && options.wsInfo != nil {
		wsinfo = options.wsInfo
	} else {
		wsinfo, err = supervisorClient.Info.WorkspaceInfo(ctx, &supervisorapi.WorkspaceInfoRequest{})
		if err != nil {
			return nil, xerrors.Errorf("failed getting workspace info from supervisor: %w", err)
		}
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

	operations := "create/get/update/delete"
	if options != nil && options.setEnvScope == envScopeUser {
		// Updating user env vars requires a different token with a special scope
		repositoryPattern = "*/*"
		operations = "update"
	}

	clientToken, err := supervisorClient.Token.GetToken(ctx, &supervisorapi.GetTokenRequest{
		Host: wsinfo.GitpodApi.Host,
		Kind: "gitpod",
		Scope: []string{
			"function:getWorkspaceEnvVars",
			"function:setEnvVar",
			"function:deleteEnvVar",
			"resource:envVar::" + repositoryPattern + "::" + operations,
		},
	})
	if err != nil {
		return nil, xerrors.Errorf("failed getting token from supervisor: %w", err)
	}
	var serverLog *log.Entry
	if options != nil && options.log != nil {
		serverLog = options.log
	} else {
		serverLog = log.NewEntry(log.StandardLogger())
	}
	client, err := serverapi.ConnectToServer(wsinfo.GitpodApi.Endpoint, serverapi.ConnectToServerOpts{
		Token:   clientToken.Token,
		Context: ctx,
		Log:     serverLog,
	})
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to server: %w", err)
	}
	return &connectToServerResult{repositoryPattern, wsinfo, client, wsinfo.GitpodHost}, nil
}

func getWorkspaceEnvs(ctx context.Context, options *connectToServerOptions) ([]*serverapi.EnvVar, error) {
	result, err := connectToServer(ctx, options)
	if err != nil {
		return nil, err
	}
	defer result.client.Close()

	return result.client.GetWorkspaceEnvVars(ctx, result.wsInfo.WorkspaceId)
}

func getEnvs(ctx context.Context) error {
	vars, err := getWorkspaceEnvs(ctx, nil)
	if err != nil {
		return xerrors.Errorf("failed to fetch env vars from server: %w", err)
	}

	for _, v := range vars {
		printVar(v.Name, v.Value, exportEnvs)
	}

	return nil
}

func setEnvs(ctx context.Context, setEnvScope envScope, args []string) error {
	options := connectToServerOptions{
		setEnvScope: setEnvScope,
	}
	result, err := connectToServer(ctx, &options)
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
				if ferr, ok := err.(*jsonrpc2.Error); ok && ferr.Code == http.StatusForbidden && setEnvScope == envScopeUser {
					return fmt.Errorf(""+
						"Can't automatically create env var `%s` for security reasons.\n"+
						"Please create the var manually under %s/user/variables using Name=%s, Scope=*/*, Value=foobar", v.Name, result.gitpodHost, v.Name)
				}
				return err
			}
			printVar(v.Name, v.Value, exportEnvs)
			return nil
		})
	}
	return g.Wait()
}

func deleteEnvs(ctx context.Context, args []string) error {
	result, err := connectToServer(ctx, nil)
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
			return nil, GpError{Err: xerrors.Errorf("empty string (correct format is key=value)"), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}

		if !strings.Contains(kv[0], "=") {
			return nil, GpError{Err: xerrors.Errorf("%s has no equal character (correct format is %s=some_value)", arg, arg), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}

		parts := strings.SplitN(kv[0], "=", 2)

		key := strings.TrimSpace(parts[0])
		if key == "" {
			return nil, GpError{Err: xerrors.Errorf("variable must have a name"), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}

		// Do not trim value - the user might want whitespace here
		// Also do not check if the value is empty, as an empty value means we want to delete the variable
		val := parts[1]
		// the value could be defined with known separators
		val = strings.Trim(val, `"`)
		val = strings.Trim(val, `'`)
		val = strings.ReplaceAll(val, `\ `, " ")

		if val == "" {
			return nil, GpError{Err: xerrors.Errorf("variable must have a value; use -u to unset a variable"), OutCome: utils.Outcome_UserErr, ErrorCode: utils.UserErrorCode_InvalidArguments}
		}

		vars[i] = &serverapi.UserEnvVarValue{Name: key, Value: val, RepositoryPattern: pattern}
	}

	return vars, nil
}

func init() {
	rootCmd.AddCommand(envCmd)

	envCmd.Flags().BoolVarP(&exportEnvs, "export", "e", false, "produce a script that can be eval'ed in Bash")
	envCmd.Flags().BoolVarP(&unsetEnvs, "unset", "u", false, "deletes/unsets persisted environment variables")
	envCmd.Flags().StringVarP(&scope, "scope", "s", "repo", "deletes/unsets persisted environment variables")
}
