// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

// ClusterType is the type of cluster to be created e.g. k3s, gke etc
type ClusterType string

const (
	// ClusterTypeGKE represents a cluster of type Google Kubernetes Engine (GKE)
	ClusterTypeGKE ClusterType = "gke"
	// ClusterTypeK3s represents a kubernetes cluster created using k3s distribution on GCP
	ClusterTypeK3s ClusterType = "k3s"
)

// MetaCluster represents a meta cluster
type MetaCluster struct {
	Name   string `yaml:"name"`
	Region string `yaml:"region"`
	Prefix string `yaml:"prefix"`
}

// WorkspaceCluster represents a workspace cluster
type WorkspaceCluster struct {
	Name        string      `yaml:"name"`
	Region      string      `yaml:"region"`
	Prefix      string      `yaml:"prefix"`
	GovernedBy  string      `yaml:"governedBy"`
	ClusterType ClusterType `yaml:"type"`
	ValuesFiles []string    `yaml:"valuesFiles"`
}

// Overrides are used to override some of the default behaviour
// of deployment
type Overrides struct {
	// DryRun specifies if the resources should be actually created or not
	DryRun bool
	// OverwriteExisting is used to overwrite existing cluster configuration
	// e.g. if a cluster X already exist and you run the deployment with this
	// value set, then it will just update the cluster configuration
	// if this flag is not set then it will error out complaining that the cluster already exists
	OverwriteExisting bool
}
