// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package integration

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/bufbuild/connect-go"
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

		httpClient, connOpts, endpoint := getPAPIConnSettings(hostURL, tkn, true)

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
