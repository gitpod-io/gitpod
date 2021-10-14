package v1

// Here is a sample representation of yaml configuration
//
// version: v1
// environment: production
// metaClusters:
//   - name: prod-meta-eu00
//   - name: prod-meta-us01
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
	Version     string `yaml:"version"`
	Environment string `yaml:"environment"`
	// MetaClusters is optional as we may not want to register the cluster
	MetaClusters      []*MetaCluster     `yaml:"metaClusters"`
	WorkspaceClusters []WorkspaceCluster `yaml:"workspaceClusters"`
	// TODO(princerachit): Add gitpod version here when we decide to use installed instead of relying solely on ops repository
}

type MetaCluster struct {
	Project *Project
	Name    string `yaml:"name"`
	Region  string `yaml:"region"`
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
