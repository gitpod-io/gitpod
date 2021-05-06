// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package kedge

import (
	v1 "k8s.io/api/core/v1"
)

// Service is a replicable Kubernetes service incl. its endpoints
type Service struct {
	Name     string        `json:"name"`
	Service  *v1.Service   `json:"service"`
	Endpoint *v1.Endpoints `json:"endpoint"`
}
