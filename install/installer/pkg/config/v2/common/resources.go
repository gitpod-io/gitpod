// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import corev1 "k8s.io/api/core/v1"

type Resources struct {
	// todo(sje): add custom validation to corev1.ResourceList
	Requests corev1.ResourceList `json:"requests" validate:"required"`
	Limits   corev1.ResourceList `json:"limits,omitempty"`
}
