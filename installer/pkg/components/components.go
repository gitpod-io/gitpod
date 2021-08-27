package components

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"

	"k8s.io/apimachinery/pkg/runtime"
)

type compositeRenderable []common.Renderable

func (cr compositeRenderable) Render(cfg *config.Config) ([]runtime.Object, error) {
	var res []runtime.Object
	for _, c := range cr {
		objs, err := c.Render(cfg)
		if err != nil {
			return nil, err
		}
		res = append(res, objs...)
	}
	return res, nil
}

var MetaObjects common.Renderable = compositeRenderable{}

var WorkspaceObjects common.Renderable = compositeRenderable{
	wsdaemon.Objects{},
}
