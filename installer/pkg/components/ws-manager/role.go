package wsmanager

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func role(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !ctx.Config.InstallNetworkPolicies {
		return nil, nil
	}

	labels := common.DefaultLabels(component)

	return []runtime.Object{
		&rbacv1.Role{
			TypeMeta: common.TypeMetaNetworkPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{""},
					Resources: []string{
						"pods",
						"pods/log",
						"events",
						"services",
						"endpoints",
						"configmaps",
					},
					Verbs: []string{
						"get",
						"list",
						"create",
						"update",
						"patch",
						"watch",
						"delete",
						"deletecollection",
					},
				},
			},
		},
	}, nil
}
