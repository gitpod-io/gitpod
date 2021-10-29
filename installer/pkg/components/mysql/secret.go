// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package mysql

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func secrets(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !enabled(ctx) {
		return nil, nil
	}

	rootPassword, err := common.RandomString(20)
	if err != nil {
		return nil, err
	}

	password, err := common.RandomString(20)
	if err != nil {
		return nil, err
	}

	return []runtime.Object{&corev1.Secret{
		TypeMeta: common.TypeMetaSecret,
		ObjectMeta: metav1.ObjectMeta{
			Name:      SQLPasswordName,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Data: map[string][]byte{
			"mysql-root-password": []byte(rootPassword),
			"mysql-password":      []byte(password),
		},
	}, &corev1.Secret{
		TypeMeta: common.TypeMetaSecret,
		ObjectMeta: metav1.ObjectMeta{
			Name:      InClusterDbSecret,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Data: map[string][]byte{
			"database": []byte(Database),
			"host":     []byte(Component),
			"port":     []byte(fmt.Sprintf("%d", Port)),
			"password": []byte(password),
			"username": []byte(Username),
		},
	}}, nil
}
