// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package helm

import "fmt"

const (
	CertManagerName        = "cert-manager"
	CertManagerNamespace   = "cert-manager"
	CertManagerRepoName    = "jetstack"
	CertManagerRepoURL     = "https://charts.jetstack.io"
	GitpodDirectory        = "gitpod"
	HelmTemplatesDirectory = "templates"
	JaegerName             = "jaeger"
	JaegerNamespace        = "jaeger-operator"
	JaegerRepoName         = "jaegertracing"
	JaegerRepoURL          = "https://jaegertracing.github.io/helm-charts"
)

var CertManagerChart = fmt.Sprintf("%s/cert-manager", CertManagerRepoName)
var JaegerChart = fmt.Sprintf("%s/jaeger-operator", JaegerRepoName)
