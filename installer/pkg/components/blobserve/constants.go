// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

const (
	Component     = "blobserve"
	ContainerPort = 32224
	ServicePort   = common.BlobServeServicePort
	MaxSizeBytes  = 1024 * 1024 * 1024 // 1 Gibibyte
)
