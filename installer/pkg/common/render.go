package common

import (
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"

	"k8s.io/apimachinery/pkg/runtime"
)

// Renderable turns the config into a set of Kubernetes runtime objects
type Renderable interface {
	Render(cfg *RenderContext) ([]runtime.Object, error)
}

type RenderContext struct {
	VersionManifest versions.Manifest
	Config          config.Config
}
