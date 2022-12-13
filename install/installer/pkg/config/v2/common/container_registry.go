// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

type ContainerRegistry struct {
	InCluster                 *bool                      `json:"inCluster,omitempty" validate:"required"`
	External                  *ContainerRegistryExternal `json:"external,omitempty" validate:"required_if=InCluster false"`
	S3Storage                 *S3Storage                 `json:"s3storage,omitempty"`
	PrivateBaseImageAllowList []string                   `json:"privateBaseImageAllowList"`
}

type ContainerRegistryExternal struct {
	URL         string    `json:"url" validate:"required"`
	Certificate ObjectRef `json:"certificate" validate:"required"`
}

type S3Storage struct {
	Bucket      string    `json:"bucket" validate:"required"`
	Region      string    `json:"region" validate:"required"`
	Endpoint    string    `json:"endpoint" validate:"required"`
	Certificate ObjectRef `json:"certificate" validate:"required"`
}
