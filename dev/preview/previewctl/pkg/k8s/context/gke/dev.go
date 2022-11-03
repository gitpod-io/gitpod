// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package gke

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/sirupsen/logrus"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/gitpod-io/gitpod/previewctl/pkg/gcloud"
	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	kctx "github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context"
)

var _ kctx.Loader = (*ConfigLoader)(nil)

const (
	DevContextName = "dev"
)

type ConfigLoader struct {
	logger *logrus.Logger

	Client gcloud.Client
	Opts   ConfigLoaderOpts
}

type ConfigLoaderOpts struct {
	Logger *logrus.Logger

	Name               string
	ProjectID          string
	Zone               string
	ServiceAccountPath string
	RenamedContextName string
}

func New(ctx context.Context, opts ConfigLoaderOpts) (*ConfigLoader, error) {
	client, err := gcloud.New(ctx, opts.ServiceAccountPath)
	if err != nil {
		return nil, err
	}

	return &ConfigLoader{
		logger: opts.Logger,
		Client: client,
		Opts:   opts,
	}, nil
}

func (k *ConfigLoader) Load(ctx context.Context) (*api.Config, error) {
	name := k.Opts.Name
	cluster, err := k.Client.GetCluster(ctx, k.Opts.Name, k.Opts.ProjectID, k.Opts.Zone)
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
			APIVersion: "client.authentication.k8s.io/v1beta1",
			InstallHint: `Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke`,
			ProvideClusterInfo: true,
			InteractiveMode:    api.IfAvailableExecInteractiveMode,
		},
	}

	if k.Opts.RenamedContextName != "" {
		return k8s.RenameConfig(ret, name, k.Opts.RenamedContextName)
	}

	return ret, nil
}
