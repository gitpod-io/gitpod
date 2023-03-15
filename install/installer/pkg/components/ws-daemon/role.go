// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func role(ctx *common.RenderContext) ([]runtime.Object, error) {
	var useMk2 bool
	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		if ucfg.Workspace != nil {
			useMk2 = ucfg.Workspace.UseWsmanagerMk2
		}
		return nil
	})
	if !useMk2 {
		return nil, nil
	}

	return []runtime.Object{
		&rbacv1.Role{
			TypeMeta: common.TypeMetaRole,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: common.WorkspaceSecretsNamespace,
				Labels:    common.DefaultLabels(Component),
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{""},
					Resources: []string{"secrets"},
					Verbs: []string{
						"get",
						"list",
						"watch",
					},
				},
			},
		},
	}, nil
}
