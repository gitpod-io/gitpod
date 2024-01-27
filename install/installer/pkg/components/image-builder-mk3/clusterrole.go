// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	"k8s.io/apimachinery/pkg/runtime"
)

func clusterrole(ctx *common.RenderContext) ([]runtime.Object, error) {
	var resources []runtime.Object
	return resources, nil
}
