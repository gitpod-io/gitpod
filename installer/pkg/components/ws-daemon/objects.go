package wsdaemon

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"

	"k8s.io/apimachinery/pkg/runtime"
)

var _ common.Renderable = &Objects{}

const component = "ws-daemon"

type Objects struct {
}

func (o Objects) Render(cfg *config.Config) ([]runtime.Object, error) {
	// TODO(cw): add a function that imposes the correct order of runtime objects (e.g. namespace before pods)
	gen := []func(cfg *config.Config) (runtime.Object, error){
		configmap,
		daemonset,
	}

	var res []runtime.Object
	for _, g := range gen {
		obj, err := g(cfg)
		if err != nil {
			return nil, err
		}
		res = append(res, obj)
	}

	return res, nil
}
