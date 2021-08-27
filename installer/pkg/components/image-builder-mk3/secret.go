// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"fmt"
	util "github.com/Masterminds/goutils"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func secret(ctx *common.RenderContext) ([]runtime.Object, error) {
	keyfile, err := util.CryptoRandomAlphaNumeric(32)
	if err != nil {
		return nil, err
	}

	return []runtime.Object{&v1.Secret{
		TypeMeta: common.TypeMetaSecret,
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-authkey", Component),
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Data: map[string][]byte{
			"keyfile": []byte(keyfile),
		},
	}}, nil
}
