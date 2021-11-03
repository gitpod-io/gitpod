// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package mysql

import (
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type EncryptionKey struct {
	Name     string `json:"name"`
	Version  int    `json:"version"`
	Primary  bool   `json:"primary"`
	Material string `json:"material"`
}

func secrets(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !enabled(ctx) {
		return nil, nil
	}

	// todo(sje): replace these with values persisted across generations
	// The chart doesn't like it when you change these values
	rootPassword := "PHejMfsLvfLcG1Drs40h"
	password := "jBzVMe2w4Yi7GagadsyB"

	encryptionKeys, err := json.MarshalIndent([]EncryptionKey{{
		Name:     "general",
		Version:  1,
		Primary:  true,
		Material: "4uGh1q8y2DYryJwrVMHs0kWXJlqvHWWt/KJuNi04edI=",
	}}, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal mysql encryptionKeys: %w", err)
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
			"database":       []byte(Database),
			"encryptionKeys": encryptionKeys,
			"host":           []byte(Component),
			"port":           []byte(fmt.Sprintf("%d", Port)),
			"password":       []byte(password),
			"username":       []byte(Username),
		},
	}}, nil
}
