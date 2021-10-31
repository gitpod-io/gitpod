// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import "k8s.io/client-go/kubernetes"

// ProjectContext is a wrapper which contains information required to communicate to the
// right GCP project with correct inputs
type ProjectContext struct {
	GCPSACredFile string `yaml:"gcpSACredFile"`
	Id            string `yaml:"id"`
	Network       string `yaml:"network"`
	DNSZone       string `yaml:"dnsZone"`
	Bucket        string `yaml:"bucket"`
}

// GitpodContext is a wraper over data that is required
// to install gitpod on a cluster
type GitpodContext struct {
	// VersionsManifestFilePath is the path of versions manifests files
	VersionsManifestFilePath string
	// ValuesFiles an array of values files that would be used to set
	// configuration of gitpod
	ValuesFiles []string
}

// ClusterContext contains the context to access the cluster
type ClusterContext struct {
	KubeconfigPath string
	Client         *kubernetes.Clientset
}
