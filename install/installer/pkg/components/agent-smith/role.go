// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package agentsmith

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func role(ctx *common.RenderContext) ([]runtime.Object, error) {
	var rules []rbacv1.PolicyRule

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.Common != nil && cfg.Common.UsePodSecurityPolicies {
			rules = append(rules, rbacv1.PolicyRule{
				APIGroups:     []string{"policy"},
				Resources:     []string{"podsecuritypolicies"},
				Verbs:         []string{"use"},
				ResourceNames: []string{fmt.Sprintf("%s-ns-privileged-unconfined", ctx.Namespace)},
			})
		}
		return nil
	})

	return []runtime.Object{
		&rbacv1.Role{
			TypeMeta: common.TypeMetaRole,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Rules: append(rules, rbacv1.PolicyRule{
				APIGroups: []string{""},
				Resources: []string{"pods"},
				Verbs:     []string{"get", "update"},
			}),
		},
	}, nil
}
