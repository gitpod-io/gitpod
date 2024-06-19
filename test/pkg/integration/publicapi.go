// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
	v1connect "github.com/gitpod-io/gitpod/components/public-api/go/v1/v1connect"
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type PAPIClient struct {
	Configuration v1connect.ConfigurationServiceClient
	Prebuild      v1connect.PrebuildServiceClient
	Organization  v1connect.OrganizationServiceClient
}

// GitpodServer provides access to the Gitpod server API
func (c *ComponentAPI) PublicApi(opts ...GitpodServerOpt) (*PAPIClient, error) {
	var options gitpodServerOpts
	for _, o := range opts {
		err := o(&options)
		if err != nil {
			return nil, xerrors.Errorf("cannot access Gitpod public API: %q", err)
		}
	}

	if cl, ok := c.serverStatus.PAPIClient[options.User]; ok {
		return cl, nil
	}

	var res *PAPIClient
	err := func() error {
		tkn := c.serverStatus.Token[options.User]
		if tkn == "" {
			var err error
			tkn, err = c.createGitpodToken(options.User, []string{
				"resource:default",
				"function:*",
			})
			if err != nil {
				return err
			}
			func() {
				c.serverStatusMu.Lock()
				defer c.serverStatusMu.Unlock()
				c.serverStatus.Token[options.User] = tkn
			}()
		}

		var pods corev1.PodList
		err := c.client.Resources(c.namespace).List(context.Background(), &pods, func(opts *metav1.ListOptions) {
			opts.LabelSelector = "component=server"
		})
		if err != nil {
			return err
		}

		config, err := GetServerConfig(c.namespace, c.client)
		if err != nil {
			return err
		}

		hostURL := config.HostURL
		if hostURL == "" {
			return xerrors.Errorf("server config: empty HostURL")
		}

		hostURL = strings.ReplaceAll(hostURL, "http://", "")
		hostURL = strings.ReplaceAll(hostURL, "https://", "")

		httpClient, connOpts, endpoint := getPAPIConnSettings(hostURL, tkn, false)

		Configuration := v1connect.NewConfigurationServiceClient(httpClient, endpoint, connOpts...)
		Prebuild := v1connect.NewPrebuildServiceClient(httpClient, endpoint, connOpts...)
		Organization := v1connect.NewOrganizationServiceClient(httpClient, endpoint, connOpts...)

		cl := &PAPIClient{
			Configuration: Configuration,
			Prebuild:      Prebuild,
			Organization:  Organization,
		}

		func() {
			c.serverStatusMu.Lock()
			defer c.serverStatusMu.Unlock()
			c.serverStatus.PAPIClient[options.User] = cl
		}()

		res = cl

		return nil
	}()
	if err != nil {
		return nil, xerrors.Errorf("cannot access Gitpod public API: %q", err)
	}

	return res, nil
}

func getPAPIConnSettings(gitpodHost, token string, useCookie bool) (*http.Client, []connect.ClientOption, string) {
	httpClient := &http.Client{
		Transport: &authenticatedTransport{Token: token, T: http.DefaultTransport, UseCookie: useCookie},
	}
	connOpts := []connect.ClientOption{
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
	papiEndpoint := fmt.Sprintf("https://%s/public-api", gitpodHost)
	return httpClient, connOpts, papiEndpoint
}

type authenticatedTransport struct {
	T         http.RoundTripper
	UseCookie bool
	Token     string
}

func (t *authenticatedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.UseCookie {
		req.Header.Add("Cookie", t.Token)
	} else {
		req.Header.Add("Authorization", "Bearer "+t.Token)
	}
	return t.T.RoundTrip(req)
}

func (c *ComponentAPI) GetTeam(ctx context.Context, papi *PAPIClient) (string, error) {
	resp, err := papi.Organization.ListOrganizations(ctx, &connect.Request[v1.ListOrganizationsRequest]{})
	if err != nil {
		return "", err
	}
	if len(resp.Msg.GetOrganizations()) > 0 {
		return resp.Msg.GetOrganizations()[0].Id, nil
	}
	resp2, err := papi.Organization.CreateOrganization(ctx, &connect.Request[v1.CreateOrganizationRequest]{
		Msg: &v1.CreateOrganizationRequest{
			Name: "integration-test",
		},
	})
	if err != nil {
		return "", err
	}
	return resp2.Msg.Organization.Id, nil
}

func (c *ComponentAPI) GetProject(ctx context.Context, papi *PAPIClient, teamID, repoName, repoUrl string, prebuildEnabled bool) (string, error) {
	resp, err := papi.Configuration.ListConfigurations(ctx, &connect.Request[v1.ListConfigurationsRequest]{
		Msg: &v1.ListConfigurationsRequest{
			OrganizationId: teamID,
			SearchTerm:     repoName,
		},
	})
	if err != nil {
		return "", err
	}
	projectID := ""
	for _, cfg := range resp.Msg.Configurations {
		if cfg.CloneUrl == repoUrl {
			projectID = cfg.Id
		}
	}
	if projectID == "" {
		resp, err := papi.Configuration.CreateConfiguration(ctx, &connect.Request[v1.CreateConfigurationRequest]{
			Msg: &v1.CreateConfigurationRequest{
				OrganizationId: teamID,
				Name:           repoName,
				CloneUrl:       repoUrl,
			},
		})
		if err != nil {
			return "", err
		}
		projectID = resp.Msg.Configuration.Id
	}

	if prebuildEnabled {
		db, err := c.DB()
		if err != nil {
			return "", err
		}
		prebuildSettings := map[string]interface{}{
			"prebuilds": map[string]interface{}{
				"enable":           true,
				"prebuildInterval": 20,
			},
		}
		prebuildSettingsBytes, err := json.Marshal(prebuildSettings)
		if err != nil {
			return "", err
		}

		_, err = db.ExecContext(ctx, `UPDATE d_b_project SET settings=? WHERE id=?`, string(prebuildSettingsBytes), projectID)
		if err != nil {
			return "", err
		}
	}

	return projectID, nil
}

func (c *ComponentAPI) TriggerPrebuild(ctx context.Context, papi *PAPIClient, projectID, branchName string) (string, error) {
	resp, err := papi.Prebuild.StartPrebuild(ctx, &connect.Request[v1.StartPrebuildRequest]{
		Msg: &v1.StartPrebuildRequest{
			ConfigurationId: projectID,
			GitRef:          branchName,
		},
	})
	if err != nil {
		return "", err
	}
	return resp.Msg.PrebuildId, nil
}

func (c *ComponentAPI) WaitForPrebuild(ctx context.Context, papi *PAPIClient, prebuildID string) (bool, error) {
	resp, err := papi.Prebuild.WatchPrebuild(ctx, &connect.Request[v1.WatchPrebuildRequest]{
		Msg: &v1.WatchPrebuildRequest{
			Scope: &v1.WatchPrebuildRequest_PrebuildId{
				PrebuildId: prebuildID,
			},
		},
	})
	if err != nil {
		return false, fmt.Errorf("watch prebuild failed: %w", err)
	}
	// Note: it's not able to close the stream here
	// defer resp.Close()
	for ctx.Err() == nil {
		if ok := resp.Receive(); !ok {
			return false, fmt.Errorf("watch prebuild failed: %w", resp.Err())
		}
		phase := resp.Msg().GetPrebuild().GetStatus().GetPhase().Name
		if phase == v1.PrebuildPhase_PHASE_BUILDING || phase == v1.PrebuildPhase_PHASE_QUEUED {
			continue
		}
		if phase == v1.PrebuildPhase_PHASE_AVAILABLE {
			return true, nil
		}
		return false, fmt.Errorf("prebuild failed: %s", phase.String())
	}
	return false, ctx.Err()
}

func (c *ComponentAPI) WaitForPrebuildWorkspaceToStoppedPhase(ctx context.Context, prebuildID string) error {
	db, err := c.DB()
	if err != nil {
		return err
	}
	var phase string
	for ctx.Err() == nil {
		if err := db.QueryRowContext(ctx, `SELECT phase FROM d_b_workspace_instance WHERE workspaceId=(SELECT buildWorkspaceId FROM d_b_prebuilt_workspace WHERE id=?) LIMIT 1`, prebuildID).Scan(&phase); err != nil {
			return err
		}
		if phase == "stopped" {
			return nil
		}
		time.Sleep(5 * time.Second)
	}
	return ctx.Err()
}
