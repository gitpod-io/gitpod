// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"

	"k8s.io/apimachinery/pkg/runtime"
)

type RenderFunc func(cfg *RenderContext) ([]runtime.Object, error)

// Renderable turns the config into a set of Kubernetes runtime objects
type Renderable interface {
	Render(cfg *RenderContext) ([]runtime.Object, error)
}

type RenderContext struct {
	VersionManifest versions.Manifest
	Config          config.Config
}
