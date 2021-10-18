package common

import (
	"strings"

	validation "github.com/go-ozzo/ozzo-validation"
	"golang.org/x/xerrors"
	"k8s.io/client-go/kubernetes"
)

// ClusterType is the type of cluster to be created e.g. k3s, gke etc
type ClusterType string

// Environment is the cluster environment i.e. staging, production etc.
type Environment string

const (
	// ClusterTypeGKE represents a cluster of type Google Kubernetes Engine (GKE)
	ClusterTypeGKE ClusterType = "gke"
	// ClusterTypeK3s represents a kubernetes cluster created using k3s distribution on GCP
	ClusterTypeK3s ClusterType = "k3s"

	// EnvironmentStaging refers to the staging environment
	EnvironmentStaging Environment = "staging"
	// EnvironmentProduction refers to the production environment
	EnvironmentProduction Environment = "production"
)

// MetaCluster represents a meta cluster
type MetaCluster struct {
	Name   string `yaml:"name"`
	Region string `yaml:"region"`
}

// WorkspaceCluster represents a workspace cluster
type WorkspaceCluster struct {
	Name        string      `yaml:"name"`
	Region      string      `yaml:"string"`
	Prefix      string      `yaml:"prefix"`
	GovernedBy  string      `yaml:"governedBy"`
	ClusterType ClusterType `yaml:"clusterType"`
	Create      bool        `yaml:"create"`
}

// ClusterContext contains the context to access the cluster
type ClusterContext struct {
	KubeconfigPath string
	Client         *kubernetes.Clientset
}

// AreValidMetaClusters validates if the MetaCluster config is valid
func AreValidMetaClusters(value interface{}) error {
	mcs, ok := value.([]*MetaCluster)
	if !ok {
		return xerrors.Errorf("value not a valid []*MetaCluster")
	}
	for _, mc := range mcs {
		err := validation.ValidateStruct(&mc,
			validation.Field(strings.TrimSpace(mc.Name), validation.Required),
			validation.Field(strings.TrimSpace(mc.Region), validation.Required),
		)
		if err != nil {
			return xerrors.Errorf("invalid MetaCluster: %s", err)
		}
	}
	return nil
}

// AreValidMetaClusters validates if the WorkspaceCluster config is valid
func AreValidWorkspaceClusters(value interface{}) error {
	wcs, ok := value.([]WorkspaceCluster)
	if !ok {
		return xerrors.Errorf("value not a valid []WorkspaceCluster")
	}
	for _, wc := range wcs {
		err := validation.ValidateStruct(&wc,
			validation.Field(strings.TrimSpace(wc.Name), validation.Required),
			validation.Field(strings.TrimSpace(wc.Region), validation.Required),
			validation.Field(strings.TrimSpace(wc.Prefix), validation.Required),
			validation.Field(strings.TrimSpace(wc.GovernedBy), validation.Required),
		)
		if err != nil {
			return xerrors.Errorf("invalid WorkspaceCluster: %s", err)
		}
	}
	return nil
}
