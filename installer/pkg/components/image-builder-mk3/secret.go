// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/google/uuid"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func secret(ctx *common.RenderContext) ([]runtime.Object, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	return []runtime.Object{&corev1.Secret{
		TypeMeta: common.TypeMetaSecret,
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-authkey", Component),
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Data: map[string][]byte{
			"keyfile": []byte(id.String()),
		},
	}}, nil
}
