package registryfacade

import "github.com/gitpod-io/gitpod/installer/pkg/common"

var Objects = common.CompositeRenderFunc(
	clusterrole,
	configmap,
	daemonset,
	networkpolicy,
	podsecuritypolicy,
	rolebinding,
	common.GenerateService(Component),
	common.DefaultServiceAccount(Component),
)
