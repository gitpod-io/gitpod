package wsdaemon

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func clusterrole(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(component)

	return []runtime.Object{
		&rbacv1.ClusterRole{
			TypeMeta: common.TypeMetaClusterRole,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Rules: []rbacv1.PolicyRule{{
				APIGroups: []string{"policy"},
				Resources: []string{"podsecuritypolicies"},
				Verbs:     []string{"use"},
				ResourceNames: []string{
					fmt.Sprintf("%s-ns-privileged-unconfined", ctx.Namespace),
				},
			}, {
				APIGroups: []string{""},
				Resources: []string{"nodes"},
				Verbs:     []string{"get", "list", "update", "patch"},
			}, {
				APIGroups: []string{""},
				Resources: []string{"pods", "services"},
				Verbs:     []string{"get", "list", "watch"},
			}, {
				APIGroups: []string{""},
				Resources: []string{"pods"},
				Verbs:     []string{"delete", "update", "patch"},
			},
			},
		}}, nil
}
