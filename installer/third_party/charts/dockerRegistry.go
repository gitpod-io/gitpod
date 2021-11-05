// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

import (
	"embed"
)

// Imported from https://github.com/twuni/docker-registry.helm

//go:embed docker-registry/*
var dockerRegistry embed.FS

func DockerRegistry() *Chart {
	return &Chart{
		Name:     "docker-registry",
		Location: "docker-registry/",
		Content:  &dockerRegistry,
	}
}
