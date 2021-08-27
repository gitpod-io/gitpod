package common

import (
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"

	"k8s.io/apimachinery/pkg/runtime"
)

// Renderable turns the config into a set of Kubernetes runtime objects
type Renderable interface {
	Render(cfg *config.Config) ([]runtime.Object, error)
}

type RenderContext struct {
	Version         string
	VersionManifest map[string]string
	Config          *config.Config
}
