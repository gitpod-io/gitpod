// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package gcloud

import (
	"context"

	"google.golang.org/api/container/v1"
	"google.golang.org/api/option"
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
)

var _ Client = (*Config)(nil)

type Client interface {
	GetCluster(ctx context.Context, name, projectID, zone string) (*container.Cluster, error)
}

type Config struct {
	gkeService *container.Service
}

func New(ctx context.Context, serviceAccountPath string) (*Config, error) {
	var opts []option.ClientOption
	if serviceAccountPath != "" {
		opts = append(opts, option.WithCredentialsFile(serviceAccountPath))
	}

	client, err := container.NewService(ctx, opts...)
	if err != nil {
		return nil, err
	}

	return &Config{
		gkeService: client,
	}, err
}

func (c *Config) GetCluster(ctx context.Context, name, projectID, zone string) (*container.Cluster, error) {
	return c.gkeService.Projects.Zones.Clusters.Get(projectID, zone, name).Context(ctx).Do()
}
