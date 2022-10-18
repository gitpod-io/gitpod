// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package gcloud

import (
	"context"
	"encoding/base64"
	"fmt"

	"google.golang.org/api/container/v1"
	"google.golang.org/api/option"
	_ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
	"k8s.io/client-go/tools/clientcmd/api"

	kube "github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
)

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

func (c *Config) GenerateConfig(ctx context.Context, name, projectID, zone, renamedContext string) (*api.Config, error) {
	cluster, err := c.GetCluster(ctx, name, projectID, zone)
	if err != nil {
		return nil, err
	}

	ret := &api.Config{
		APIVersion: "v1",
		Kind:       "Config",
		Clusters:   map[string]*api.Cluster{},  // Clusters is a map of referencable names to cluster configs
		AuthInfos:  map[string]*api.AuthInfo{}, // AuthInfos is a map of referencable names to user configs
		Contexts:   map[string]*api.Context{},  // Contexts is a map of referencable names to context configs
	}

	cert, err := base64.StdEncoding.DecodeString(cluster.MasterAuth.ClusterCaCertificate)
	if err != nil {
		return nil, fmt.Errorf("invalid certificate cluster=%s cert=%s: %w", name, cluster.MasterAuth.ClusterCaCertificate, err)
	}

	ret.Clusters[name] = &api.Cluster{
		CertificateAuthorityData: cert,
		Server:                   "https://" + cluster.Endpoint,
	}

	// Just reuse the context name as an auth name.
	ret.Contexts[name] = &api.Context{
		Cluster:  name,
		AuthInfo: name,
	}

	// GCP specific configuration; use cloud platform scope.
	ret.AuthInfos[name] = &api.AuthInfo{
		Exec: &api.ExecConfig{
			Command:    "gke-gcloud-auth-plugin",
			Args:       nil,
			Env:        nil,
			APIVersion: "client.authentication.k8s.io/v1beta1",
			InstallHint: `Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke`,
			ProvideClusterInfo: true,
			InteractiveMode:    api.IfAvailableExecInteractiveMode,
		},
	}

	if renamedContext != "" {
		return kube.RenameContext(ret, name, renamedContext)
	}

	return ret, nil
}
