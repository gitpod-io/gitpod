package v1

import (
	"strings"

	validation "github.com/go-ozzo/ozzo-validation"
	"golang.org/x/xerrors"
)

// Here is a sample representation of yaml configuration
//
// version: v1
// environment: production
// project: gitpod-staging
// metaClusters:
//   - name: prod-meta-eu00
//     region: europe-west1
//   - name: prod-meta-us01
//     region: us-west-1
// workspaceClusters:
//   - name: europe
//     region: europe-west1
//     prefix: eu
//     governedBy: prod-meta-eu01
//     create: true
//   - name: us
//     region: us-east1
//     prefix: us
//     governedBy: prod-meta-us01
//     create: true

type Config struct {
	// We do not support cross project deployment
	// All deployments would be in the same GCP project
	Project     *Project
	Version     string `yaml:"version"`
	Environment string `yaml:"environment"`
	// MetaClusters is optional as we may not want to register the cluster
	MetaClusters      []*MetaCluster     `yaml:"metaClusters"`
	WorkspaceClusters []WorkspaceCluster `yaml:"workspaceClusters"`
	// TODO(princerachit): Add gitpod version here when we decide to use installed instead of relying solely on ops repository
}

type MetaCluster struct {
	Name   string `yaml:"name"`
	Region string `yaml:"region"`
}

type WorkspaceCluster struct {
	Name        string `yaml:"name"`
	Region      string `yaml:"string"`
	Prefix      string `yaml:"prefix"`
	GovernedBy  string `yaml:"governedBy"`
	ClusterType string `yaml:"clusterType"`
	Create      bool   `yaml:"create"`
}

type Project struct {
	Name string `yaml:"name"`
}

func isValidProject(value interface{}) error {
	p, ok := value.(Project)
	if !ok {
		return xerrors.Errorf("value not a valid project")
	}
	if strings.TrimSpace(p.Name) == "" {
		return xerrors.Errorf("project Name must not be empty")
	}
	return nil
}

func areValidMetaClusters(value interface{}) error {
	mcs, ok := value.([]*MetaCluster)
	if !ok {
		return xerrors.Errorf("value not a valid []*MetaCluster")
	}
	for _, mc := range mcs {
		if strings.TrimSpace(mc.Name) == "" {
			xerrors.Errorf("meta cluster name cannot be empty")
		}
		if strings.TrimSpace(mc.Region) == "" {
			xerrors.Errorf("meta cluster region cannot be empty")
		}
	}
	return nil
}

func areValidWorkspaceClusters(value interface{}) error {
	wcs, ok := value.([]WorkspaceCluster)
	if !ok {
		return xerrors.Errorf("value not a valid []WorkspaceCluster")
	}
	for _, wc := range wcs {
		err := validation.ValidateStruct(&wc,
			validation.Field(&wc., validation.Required),
			validation.Field(&c.MetaClusters, validation.By(areValidWorkspacelusters)),
		)
	}
	return nil
}

func (c *Config) Validate() error {
	err := validation.ValidateStruct(&c,
		validation.Field(c.Version, validation.Required),
		validation.Field(c.Environment, validation.Required),
		validation.Field(c.WorkspaceClusters, validation.Required),
		validation.Field(&c.Project, validation.By(isValidProject)),
		validation.Field(&c.MetaClusters, validation.By(areValidMetaClusters)),
		validation.Field(&c.MetaClusters, validation.By(areValidWorkspacelusters)),
	)
	if err != nil {
		return xerrors.Errorf("invalid request: %w", err)
	}
	return nil
}

func areValidFeatureFlags(value interface{}) error {
	s, ok := value.([]api.WorkspaceFeatureFlag)
	if !ok {
		return xerrors.Errorf("value not a feature flag list")
	}

	idx := make(map[api.WorkspaceFeatureFlag]struct{}, len(s))
	for _, k := range s {
		idx[k] = struct{}{}
	}

	return nil
}

func (p *Project) Validate() error {
	return isValidProject(c)
}

func (mc *MetaCluster) Validate() error {
	return nil
}

func (wc *WorkspaceCluster) Validate() error {
	return nil
}
