// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package client

import (
	"errors"
	"fmt"
	"github.com/bufbuild/connect-go"
	gitpod_experimental_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"net/http"
)

type Gitpod struct {
	cfg *options

	Workspaces           gitpod_experimental_v1connect.WorkspacesServiceClient
	Teams                gitpod_experimental_v1connect.TeamsServiceClient
	Projects             gitpod_experimental_v1connect.ProjectsServiceClient
	PersonalAccessTokens gitpod_experimental_v1connect.TokensServiceClient
}

func New(options ...Option) (*Gitpod, error) {
	opts, err := evaluateOptions(defaultOptions(), options...)
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate client options: %w", err)
	}

	if opts.credentials == "" {
		return nil, errors.New("no authentication credentials specified")
	}

	client := opts.client
	url := opts.url

	serviceOpts := []connect.ClientOption{
		connect.WithInterceptors(
			AuthorizationInterceptor(opts.credentials),
		),
	}

	teams := gitpod_experimental_v1connect.NewTeamsServiceClient(client, url, serviceOpts...)
	projects := gitpod_experimental_v1connect.NewProjectsServiceClient(client, url, serviceOpts...)
	tokens := gitpod_experimental_v1connect.NewTokensServiceClient(client, url, serviceOpts...)
	workspaces := gitpod_experimental_v1connect.NewWorkspacesServiceClient(client, url, serviceOpts...)

	return &Gitpod{
		cfg:                  opts,
		Teams:                teams,
		Projects:             projects,
		PersonalAccessTokens: tokens,
		Workspaces:           workspaces,
	}, nil
}

type Option func(opts *options) error

func WithURL(url string) Option {
	return func(opts *options) error {
		opts.url = url
		return nil
	}
}

func WithCredentials(token string) Option {
	return func(opts *options) error {
		opts.credentials = token
		return nil
	}
}

func WithHTTPClient(client *http.Client) Option {
	return func(opts *options) error {
		opts.client = client
		return nil
	}
}

type options struct {
	url         string
	client      *http.Client
	credentials string
}

func defaultOptions() *options {
	return &options{
		url:    "https://api.gitpod.io",
		client: http.DefaultClient,
	}
}

func evaluateOptions(base *options, opts ...Option) (*options, error) {
	for _, opt := range opts {
		if err := opt(base); err != nil {
			return nil, fmt.Errorf("failed to evaluate options: %w", err)
		}
	}

	return base, nil
}
