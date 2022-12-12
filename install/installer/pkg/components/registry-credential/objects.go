// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry_credential

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"k8s.io/apimachinery/pkg/runtime"
)

var Objects = common.CompositeRenderFunc(
	configmap,
	role,
	rolebinding,
	cronjob,
	job,
	func(ctx *common.RenderContext) ([]runtime.Object, error) {
		if !isAWSRegistry(ctx) {
			return nil, nil
		}
		return common.DefaultServiceAccount(Component)(ctx)
	},
)
