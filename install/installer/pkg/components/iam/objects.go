// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package iam

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {
	return common.CompositeRenderFunc(
		configmap,
		deployment,
		rolebinding,
		common.DefaultServiceAccount(Component),
		service,
		networkpolicy,
	)(ctx)
}
