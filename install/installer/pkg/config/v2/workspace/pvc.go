// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import "k8s.io/apimachinery/pkg/api/resource"

type PersistentVolumeClaim struct {
	// Size is a size of persistent volume claim to use
	Size resource.Quantity `json:"size" validate:"required"`

	// StorageClass is a storage class of persistent volume claim to use
	StorageClass string `json:"storageClass"`

	// SnapshotClass is a snapshot class name that is used to create volume snapshot
	SnapshotClass string `json:"snapshotClass"`
}
