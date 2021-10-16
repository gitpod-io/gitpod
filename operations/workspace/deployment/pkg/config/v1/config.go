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
// #TODO(prs): gcpSecretPath: /var/gcp/gitpod-sa.json
//
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

	err := validation.ValidateStruct(&p,
		validation.Field(strings.TrimSpace(p.Name), validation.Required),
	)
	if err != nil {
		return xerrors.Errorf("invalid project: %s", err)
	}
	return nil
}

func areValidMetaClusters(value interface{}) error {
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

func areValidWorkspaceClusters(value interface{}) error {
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

func (c *Config) Validate() error {
	err := validation.ValidateStruct(&c,
		validation.Field(c.Version, validation.Required),
		validation.Field(c.Environment, validation.Required),
		validation.Field(c.WorkspaceClusters, validation.Required),
		validation.Field(&c.Project, validation.By(isValidProject)),
		validation.Field(&c.MetaClusters, validation.By(areValidMetaClusters)),
		validation.Field(&c.WorkspaceClusters, validation.By(areValidWorkspaceClusters)),
	)
	if err != nil {
		return xerrors.Errorf("invalid configuration: %w", err)
	}
	return nil
}
