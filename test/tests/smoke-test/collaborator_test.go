// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package smoketest

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/util"
	experimentalv1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	experimentalv1connect "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
	v1connect "github.com/gitpod-io/gitpod/components/public-api/go/v1/v1connect"
	serverapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	log "github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

/**
 *
# 1. Create an org
# 2. Invite your another account to be a collaborator of this org
# 3. Create a project in this org

cd test
export TEST_COLLABORATOR=true
export GITPOD_HOST=hw-collaborator.preview.gitpod-dev.com
export ORG_ID=130d67cf-8b11-45e9-b8d2-33bf34ca4a4c
export PROJECT_ID=699c6566-1049-469e-9e61-c8fe0db9d396

# test with cookie, cookie should format like `_hw_collaborator_preview_gitpod_dev_com_jwt2_=xxx“
export USE_COOKIE=true
	export USER_TOKEN="<your_cookie>"
go test -run "^TestMembers|TestProjects|TestGetProject$" github.com/gitpod-io/gitpod/test/tests/smoke-test -v -count=1

# test with PAT
export USE_COOKIE=false
	export USER_TOKEN=<your_pat>
go test -run "^TestMembers|TestProjects|TestGetProject$" github.com/gitpod-io/gitpod/test/tests/smoke-test -v -count=1

# debug: go test -run "^TestProjects$" github.com/gitpod-io/gitpod/test/tests/smoke-test -v -count=1
*/

func TestMembers(t *testing.T) {
	if !shouldTestCollaborator() {
		t.Skip("skipping collaborator test")
		return
	}
	userToken, _ := os.LookupEnv("USER_TOKEN")
	gitpodHost, _ := os.LookupEnv("GITPOD_HOST")
	orgID, _ := os.LookupEnv("ORG_ID")

	if _, err := connectToServer(gitpodHost, userToken); err != nil {
		t.Errorf("failed getting server conn: %v", err)
	}
	v1Http, v1Opts, v1Host := getPAPIConnSettings(gitpodHost, userToken, getUseCookie(), false)
	ev1Http, ev1Opts, ev1Host := getPAPIConnSettings(gitpodHost, userToken, getUseCookie(), true)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()
	client := experimentalv1connect.NewTeamsServiceClient(ev1Http, ev1Host, ev1Opts...)
	v1Client := v1connect.NewOrganizationServiceClient(v1Http, v1Host, v1Opts...)
	_, err := client.ListTeamMembers(ctx, connect.NewRequest(&experimentalv1.ListTeamMembersRequest{
		TeamId: orgID,
	}))
	_, err2 := v1Client.ListOrganizationMembers(ctx, connect.NewRequest(&v1.ListOrganizationMembersRequest{
		OrganizationId: orgID,
		Pagination:     &v1.PaginationRequest{},
	}))
	_, err3 := serverConn.GetTeamMembers(ctx, orgID)

	if !strings.Contains(err.Error(), "permission_denied:") {
		t.Errorf("experimental should respond permission_denied, got: %s", err)
	}
	if !strings.Contains(err2.Error(), "permission_denied:") {
		t.Errorf("v1 should respond permission_denied, got: %s", err2)
	}
	if getUseCookie() {
		if !strings.Contains(err3.Error(), "code 403 ") {
			t.Errorf("server should respond permission_denied, got: %s", err3)
		}
	}
}

func TestProjects(t *testing.T) {
	if !shouldTestCollaborator() {
		t.Skip("skipping collaborator test")
		return
	}
	userToken, _ := os.LookupEnv("USER_TOKEN")
	gitpodHost, _ := os.LookupEnv("GITPOD_HOST")
	orgID, _ := os.LookupEnv("ORG_ID")

	if _, err := connectToServer(gitpodHost, userToken); err != nil {
		t.Errorf("failed getting server conn: %v", err)
	}
	v1Http, v1Opts, v1Host := getPAPIConnSettings(gitpodHost, userToken, getUseCookie(), false)
	ev1Http, ev1Opts, ev1Host := getPAPIConnSettings(gitpodHost, userToken, getUseCookie(), false)

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()
	client := experimentalv1connect.NewProjectsServiceClient(ev1Http, ev1Host, ev1Opts...)
	v1Client := v1connect.NewConfigurationServiceClient(v1Http, v1Host, v1Opts...)
	resp, err := client.ListProjects(ctx, connect.NewRequest(&experimentalv1.ListProjectsRequest{
		TeamId:     orgID,
		Pagination: &experimentalv1.Pagination{},
	}))
	resp2, err2 := v1Client.ListConfigurations(ctx, connect.NewRequest(&v1.ListConfigurationsRequest{
		OrganizationId: orgID,
		Pagination:     &v1.PaginationRequest{},
	}))
	resp3, err3 := serverConn.GetTeamProjects(ctx, orgID)

	if getUseCookie() {
		if err != nil || err2 != nil || err3 != nil {
			t.Errorf("should respond empty array, got: %v, %v, %v", err, err2, err3)
		}
		if len(resp.Msg.GetProjects()) != 0 || len(resp2.Msg.GetConfigurations()) != 0 || len(resp3) != 0 {
			t.Errorf("should respond empty array, got: %d, %d, %d", len(resp.Msg.GetProjects()), len(resp2.Msg.GetConfigurations()), len(resp3))
		}
	} else {
		if err != nil || err2 != nil {
			t.Errorf("should respond empty array, got: %v, %v, %v", err, err2, err3)
		}

		if len(resp.Msg.GetProjects()) != 0 || len(resp2.Msg.GetConfigurations()) != 0 {
			t.Errorf("should respond empty array, got: %d, %d", len(resp.Msg.GetProjects()), len(resp2.Msg.GetConfigurations()))
		}
	}
}

func TestGetProject(t *testing.T) {
	if !shouldTestCollaborator() {
		t.Skip("skipping collaborator test")
		return
	}
	userToken, _ := os.LookupEnv("USER_TOKEN")
	gitpodHost, _ := os.LookupEnv("GITPOD_HOST")
	projectID, _ := os.LookupEnv("PROJECT_ID")

	if _, err := connectToServer(gitpodHost, userToken); err != nil {
		t.Errorf("failed getting server conn: %v", err)
	}
	v1Http, v1Opts, v1Host := getPAPIConnSettings(gitpodHost, userToken, getUseCookie(), false)

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()

	v1Client := v1connect.NewConfigurationServiceClient(v1Http, v1Host, v1Opts...)
	_, err2 := v1Client.GetConfiguration(ctx, connect.NewRequest(&v1.GetConfigurationRequest{
		ConfigurationId: projectID,
	}))
	if !strings.Contains(err2.Error(), "not_found") {
		t.Errorf("v1 should respond not_found, got: %s", err2)
	}
}

// Note: there's no usage endpoint in the server / public v1 experimental.v1 APIs

var serverConn *serverapi.APIoverJSONRPC

func shouldTestCollaborator() bool {
	should, _ := os.LookupEnv("TEST_COLLABORATOR")
	return should != "true"
}

func getUseCookie() bool {
	useCookie, _ := os.LookupEnv("USE_COOKIE")
	return useCookie == "true"
}

func connectToServer(gitpodHost, token string) (*serverapi.APIoverJSONRPC, error) {
	if serverConn != nil {
		return serverConn, nil
	}
	supervisorConn, err := grpc.Dial(util.GetSupervisorAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	defer supervisorConn.Close()
	if err != nil {
		return nil, xerrors.Errorf("failed getting token from supervisor: %w", err)
	}

	endpoint := "wss://" + gitpodHost + "/api/gitpod"
	useCookie := getUseCookie()
	opts := serverapi.ConnectToServerOpts{
		Context: context.Background(),
		Log:     log.NewEntry(log.StandardLogger()),
		ExtraHeaders: map[string]string{
			"User-Agent":       "gitpod/cli",
			"X-Client-Version": "0.0.1",
		},
	}
	if useCookie {
		opts.ExtraHeaders["Cookie"] = token
	} else {
		opts.Token = token
	}
	client, err := serverapi.ConnectToServer(endpoint, opts)
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to server: %w", err)
	}
	serverConn = client
	return client, nil
}

func getPAPIConnSettings(gitpodHost, token string, useCookie, isExperimental bool) (*http.Client, []connect.ClientOption, string) {
	client := &http.Client{
		Transport: &AuthenticatedTransport{Token: token, T: http.DefaultTransport, UseCookie: useCookie},
	}
	opts := []connect.ClientOption{
		connect.WithInterceptors(
			connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
				return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
					if req.Spec().IsClient {
						if useCookie {
							req.Header().Set("Cookie", token)
						} else {
							req.Header().Set("Authorization", fmt.Sprintf("Bearer %s", token))
						}
					}
					return next(ctx, req)
				}
			}),
		),
	}
	endpoint := fmt.Sprintf("https://%s/public-api", gitpodHost)
	if isExperimental {
		endpoint = fmt.Sprintf("https://api.%s", gitpodHost)
	}
	return client, opts, endpoint
}

type AuthenticatedTransport struct {
	T         http.RoundTripper
	UseCookie bool
	Token     string
}

func (t *AuthenticatedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.UseCookie {
		req.Header.Add("Cookie", t.Token)
	} else {
		req.Header.Add("Authorization", "Bearer "+t.Token)
	}
	return t.T.RoundTrip(req)
}
