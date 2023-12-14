// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package public_api_server

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func pdb(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{
		common.PodDisruptionBudget(ctx, Component, 1, &metav1.LabelSelector{
			MatchLabels: common.CustomizeLabel(ctx, Component, common.TypeMetaDeployment),
		}),
	}, nil
}
