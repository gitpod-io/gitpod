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
