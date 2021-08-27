// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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
	"golang.org/x/xerrors"
	"google.golang.org/grpc"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/theialib"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
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
		log.SetOutput(io.Discard)
		f, err := os.OpenFile(os.TempDir()+"/gp-env.log", os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0644)
		if err == nil {
			defer f.Close()
			log.SetOutput(f)
		}

		if len(args) > 0 {
			if unsetEnvs {
				deleteEnvs(args)
				return
			}

			setEnvs(args)
		} else {
			getEnvs()
		}
	},
}

type connectToServerResult struct {
	repositoryPattern string
	client            *serverapi.APIoverJSONRPC
}

func connectToServer(ctx context.Context) (*connectToServerResult, error) {
	supervisorAddr := os.Getenv("SUPERVISOR_ADDR")
	if supervisorAddr == "" {
		supervisorAddr = "localhost:22999"
	}
	supervisorConn, err := grpc.Dial(supervisorAddr, grpc.WithInsecure())
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	wsinfo, err := supervisor.NewInfoServiceClient(supervisorConn).WorkspaceInfo(ctx, &supervisor.WorkspaceInfoRequest{})
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
	clientToken, err := supervisor.NewTokenServiceClient(supervisorConn).GetToken(ctx, &supervisor.GetTokenRequest{
		Host: wsinfo.GitpodApi.Host,
		Kind: "gitpod",
		Scope: []string{
			"function:getEnvVars",
			"function:setEnvVar",
			"function:deleteEnvVar",
			"resource:envVar::" + repositoryPattern + "::create/get/update/delete",
		},
	})
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
	return &connectToServerResult{repositoryPattern, client}, nil
}

func getEnvs() {
	if !isTheiaIDE() {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
		defer cancel()
		result, err := connectToServer(ctx)
		if err != nil {
			fail(err.Error())
		}

		vars, err := result.client.GetEnvVars(ctx)
		if err != nil {
			fail("failed to fetch env vars from server: " + err.Error())
		}

		for _, v := range vars {
			printVar(v, exportEnvs)
		}
		return
	}

	service, err := theialib.NewServiceFromEnv()
	if err != nil {
		fail(err.Error())
	}

	vars, err := service.GetEnvVars(theialib.GetEnvvarsRequest{})
	if err != nil {
		fail(fmt.Sprintf("cannot get environment variables: %v", err))
	}

	for _, v := range vars.Variables {
		printVarFromTheia(v, exportEnvs)
	}
}

func setEnvs(args []string) {
	if !isTheiaIDE() {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
		defer cancel()
		result, err := connectToServer(ctx)
		if err != nil {
			fail(err.Error())
		}

		vars, err := parseArgs(args, result.repositoryPattern)
		if err != nil {
			fail(err.Error())
		}

		var exitCode int
		var wg sync.WaitGroup
		wg.Add(len(vars))
		for _, v := range vars {
			go func(v *serverapi.UserEnvVarValue) {
				err = result.client.SetEnvVar(ctx, v)
				if err != nil {
					fmt.Fprintf(os.Stderr, "cannot set %s: %v\n", v.Name, err)
					exitCode = -1
				} else {
					printVar(v, exportEnvs)
				}
				wg.Done()
			}(v)
		}
		wg.Wait()
		os.Exit(exitCode)
	}

	service, err := theialib.NewServiceFromEnv()
	if err != nil {
		fail(err.Error())
	}

	vars := make([]theialib.EnvironmentVariable, len(args))
	for i, arg := range args {
		kv := strings.Split(arg, "=")
		if len(kv) != 2 {
			fail(fmt.Sprintf("%s has no value (correct format is %s=some_value)", arg, arg))
		}

		key := strings.TrimSpace(kv[0])
		if key == "" {
			fail("variable must have a name")
		}
		// Do not trim value - the user might want whitespace here
		// Also do not check if the value is empty, as an empty value means we want to delete the variable
		val := kv[1]
		if val == "" {
			fail("variable must have a value; use -u to unset a variable")
		}

		vars[i] = theialib.EnvironmentVariable{Name: key, Value: val}
	}

	_, err = service.SetEnvVar(theialib.SetEnvvarRequest{Variables: vars})
	if err != nil {
		fail(fmt.Sprintf("cannot set environment variables: %v", err))
	}

	for _, v := range vars {
		printVarFromTheia(v, exportEnvs)
	}
}

func deleteEnvs(args []string) {
	if !isTheiaIDE() {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
		defer cancel()
		result, err := connectToServer(ctx)
		if err != nil {
			fail(err.Error())
		}

		var exitCode int
		var wg sync.WaitGroup
		wg.Add(len(args))
		for _, name := range args {
			go func(name string) {
				err = result.client.DeleteEnvVar(ctx, &serverapi.UserEnvVarValue{Name: name, RepositoryPattern: result.repositoryPattern})
				if err != nil {
					fmt.Fprintf(os.Stderr, "cannot unset %s: %v\n", name, err)
					exitCode = -1
				}
				wg.Done()
			}(name)
		}
		wg.Wait()
		os.Exit(exitCode)
	}

	service, err := theialib.NewServiceFromEnv()
	if err != nil {
		fail(err.Error())
	}

	resp, err := service.DeleteEnvVar(theialib.DeleteEnvvarRequest{Variables: args})
	if err != nil {
		fail(fmt.Sprintf("cannot unset environment variables: %v", err))
	}

	if len(resp.NotDeleted) != 0 {
		fail(fmt.Sprintf("cannot unset environment variables: %s", strings.Join(resp.NotDeleted, ", ")))
	}
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(-1)
}

func printVar(v *serverapi.UserEnvVarValue, export bool) {
	val := strings.Replace(v.Value, "\"", "\\\"", -1)
	if export {
		fmt.Printf("export %s=\"%s\"\n", v.Name, val)
	} else {
		fmt.Printf("%s=%s\n", v.Name, val)
	}
}

func printVarFromTheia(v theialib.EnvironmentVariable, export bool) {
	val := strings.Replace(v.Value, "\"", "\\\"", -1)
	if export {
		fmt.Printf("export %s=\"%s\"\n", v.Name, val)
	} else {
		fmt.Printf("%s=%s\n", v.Name, val)
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
