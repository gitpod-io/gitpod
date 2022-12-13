// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import "github.com/gitpod-io/gitpod/installer/pkg/config/v2/common"

type ObjectStorage struct {
	InCluster    *bool                      `json:"inCluster,omitempty"`
	S3           *ObjectStorageS3           `json:"s3,omitempty"`
	CloudStorage *ObjectStorageCloudStorage `json:"cloudStorage,omitempty"`
	Azure        *ObjectStorageAzure        `json:"azure,omitempty"`
	// DEPRECATED
	MaximumBackupCount *int              `json:"maximumBackupCount,omitempty"`
	BlobQuota          *int64            `json:"blobQuota,omitempty"`
	Resources          *common.Resources `json:"resources,omitempty"`
}

type ObjectStorageS3 struct {
	Endpoint    string           `json:"endpoint" validate:"required"`
	Credentials common.ObjectRef `json:"credentials" validate:"required"`

	BucketName string `json:"bucket" validate:"required"`

	AllowInsecureConnection bool `json:"allowInsecureConnection"`
}

type ObjectStorageCloudStorage struct {
	ServiceAccount common.ObjectRef `json:"serviceAccount" validate:"required"`
	Project        string           `json:"project" validate:"required"`
}

type ObjectStorageAzure struct {
	Credentials common.ObjectRef `json:"credentials" validate:"required"`
}
