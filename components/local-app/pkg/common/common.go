// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"net/url"
	"os"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/components/public-api/go/client"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/gitpod-io/local-app/pkg/constants"
	"github.com/manifoldco/promptui"
	"github.com/zalando/go-keyring"
)

// GetToken returns the persisted Gitpod token
func GetTokenKeychain(host string) (token string, err error) {
	tkn, err := keyring.Get(constants.Flavor, host)
	if errors.Is(err, keyring.ErrNotFound) {
		return "", nil
	}
	return tkn, err
}

func GetToken() (string, error) {
	host := config.GetString("host")
	token, err := GetTokenKeychain(host)

	if err != nil {
		configToken := config.GetString("token")
		if configToken == "" {
			return "", fmt.Errorf("no token found in keychain for %s, config file or the GITPOD_TOKEN environment variable. Please run `gitpod login` to login", host)
		}

		return configToken, nil
	}

	return token, nil
}

type authTransport struct {
	T     http.RoundTripper
	token string
}

func (t *authTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Add("Authorization", "Bearer "+t.token)
	return t.T.RoundTrip(req)
}

func ConstructGitpodClient(ctx context.Context, token string) (*client.Gitpod, error) {
	gitpodApiEndpoint, err := constructAPIEndpoint()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to construct gitpod API endpoint: %v\n", err)
		return nil, err
	}

	at := &authTransport{T: http.DefaultTransport, token: token}
	customClient := &http.Client{
		Transport: at,
	}

	gp, err := client.New(client.WithHTTPClient(customClient), client.WithCredentials(token), client.WithURL(gitpodApiEndpoint))
	client.AuthorizationInterceptor(token)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to construct gitpod client: %v\n", err)
		return nil, err
	}

	return gp, nil
}

func GetGitpodClient(ctx context.Context) (*client.Gitpod, error) {
	token, err := GetToken()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to get gitpod token: %v\n", err)
		return nil, err
	}

	return ConstructGitpodClient(ctx, token)
}

func constructAPIEndpoint() (string, error) {
	host := config.GetString("host")

	u := &url.URL{
		Scheme: "https",
		Host:   "api." + host,
	}

	endpoint := u.String()

	// Validate the constructed URL
	if _, err := url.ParseRequestURI(endpoint); err != nil {
		return "", err
	}

	return endpoint, nil
}

type WorkspaceFilter func(ws *v1.Workspace) bool

func SelectWorkspace(ctx context.Context, filter WorkspaceFilter) string {
	gitpod, err := GetGitpodClient(ctx)

	if err != nil {
		log.Fatal(err)
	}

	workspaceList, err := gitpod.Workspaces.ListWorkspaces(ctx, connect.NewRequest(&v1.ListWorkspacesRequest{}))

	if err != nil {
		log.Fatal(err)
	}

	wsIds := []string{}

	for _, ws := range workspaceList.Msg.GetResult() {
		// If no filter is provided, or if the filter returns true for this workspace, include it in the list
		if filter == nil || filter(ws) {
			wsIds = append(wsIds, ws.WorkspaceId)
		}
	}

	if len(wsIds) == 0 {
		slog.Error("No workspaces found to use")
		return ""
	}

	if len(wsIds) == 1 {
		slog.Info("Only one workspace found, automatically selecting it")
		return wsIds[0]
	}

	prompt := promptui.Select{
		Label: "Select a Workspace",
		Items: wsIds,
	}

	_, result, err := prompt.Run()

	if err != nil {
		fmt.Printf("Prompt failed %v\n", err)
		return ""
	}

	return result
}

func SelectOrganization(ctx context.Context) string {
	gitpod, err := GetGitpodClient(ctx)

	if err != nil {
		slog.ErrorContext(ctx, "Failed to setup Gitpod API client", err)
	}

	orgsList, err := gitpod.Teams.ListTeams(ctx, connect.NewRequest(&v1.ListTeamsRequest{}))

	if err != nil {
		slog.ErrorContext(ctx, "Failed to list organizations", err)
	}

	orgIds := []string{}

	for _, org := range orgsList.Msg.GetTeams() {
		orgIds = append(orgIds, org.Id)
	}

	if len(orgIds) == 0 {
		slog.Error("No organization found")
		return ""
	}

	if len(orgIds) == 1 {
		slog.Debug("Only one organization found, automatically selecting it")
		return orgIds[0]
	}

	prompt := promptui.Select{
		Label: "Select a Workspace",
		Items: orgIds,
	}

	_, result, err := prompt.Run()

	if err != nil {
		slog.ErrorContext(ctx, "Prompt failed", err)
		return ""
	}

	return result
}
