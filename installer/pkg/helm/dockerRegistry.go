// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package helm

import (
	_ "embed"
)

//go:embed docker-registry/Chart.yaml
var dockerRegistryChart []byte

//go:embed docker-registry/values.yaml
var dockerRegistryValues []byte

func DockerRegistry() *Chart {
	return &Chart{
		Name:   "docker-registry",
		Chart:  dockerRegistryChart,
		Values: dockerRegistryValues,
	}
}
