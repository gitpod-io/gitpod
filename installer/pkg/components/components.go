// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package components

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"

	"k8s.io/apimachinery/pkg/runtime"
)

type compositeRenderable []common.Renderable

func (cr compositeRenderable) Render(ctx *common.RenderContext) ([]runtime.Object, error) {
	var res []runtime.Object
	for _, c := range cr {
		objs, err := c.Render(ctx)
		if err != nil {
			return nil, err
		}
		res = append(res, objs...)
	}
	return res, nil
}

var MetaObjects common.Renderable = compositeRenderable{}

var WorkspaceObjects common.Renderable = compositeRenderable{
	wsdaemon.Objects{},
}
