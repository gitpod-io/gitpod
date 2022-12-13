// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import corev1 "k8s.io/api/core/v1"

type ObjectRef struct {
	Kind ObjectRefKind `json:"kind" validate:"required,objectref_kind"`
	Name string        `json:"name" validate:"required"`
}

// The ObjectRef will mostly be used as a volume source - this helper function does the boilerplate for you
func (o *ObjectRef) ToVolumeSource() (v corev1.VolumeSource) {
	switch o.Kind {
	case ObjectRefSecret:
		v.Secret = &corev1.SecretVolumeSource{
			SecretName: o.Name,
		}
	case ObjectRefConfigMap:
		v.ConfigMap = &corev1.ConfigMapVolumeSource{
			LocalObjectReference: corev1.LocalObjectReference{
				Name: o.Name,
			},
		}
	}

	return v
}

type ObjectRefKind string

const (
	ObjectRefSecret    ObjectRefKind = "secret"
	ObjectRefConfigMap ObjectRefKind = "configmap"
)
