// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry_credential

import (
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

func Objects(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !IsAWSECRURL(ctx) {
		return nil, nil
	}
	return common.CompositeRenderFunc(
		configmap,
		role,
		rolebinding,
		cronjob,
		common.DefaultServiceAccount(Component),
	)(ctx)
}
