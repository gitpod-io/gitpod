package wsscheduler

import "github.com/gitpod-io/gitpod/installer/pkg/common"

var Objects = common.CompositeRenderFunc(
	clusterrole,
	clusterrolebinding,
	configmap,
	deployment,
	networkpolicy,
	common.DefaultServiceAccount(Component),
)
