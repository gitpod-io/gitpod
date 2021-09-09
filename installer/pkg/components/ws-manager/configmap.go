package wsmanager

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {

	//wsmcfg := manager.Configuration{}

	//fc, err := json.MarshalIndent(wsmcfg, "", " ")
	//if err != nil {
	//	return nil, fmt.Errorf("failed to marshal ws-daemon config: %w", err)
	//}
	//
	return []runtime.Object{
		//	&v1.ConfigMap{
		//		TypeMeta: common.TypeMetaNetworkPolicy,
		//		ObjectMeta: metav1.ObjectMeta{
		//			Name:      component,
		//			Namespace: ctx.Namespace,
		//			Labels:    common.DefaultLabels(component),
		//		},
		//		Data: map[string]string{
		//			"config.json": string(fc),
		//		},
		//	},
	}, nil
}
