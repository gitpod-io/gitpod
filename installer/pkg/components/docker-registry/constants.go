// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dockerregistry

import "github.com/gitpod-io/gitpod/installer/pkg/common"

const (
	BuiltInRegistryAuth  = common.RegistryAuthSecret
	BuiltInRegistryCerts = common.RegistryTLSCertSecret
	Component            = "docker-registry"
	RegistryName         = "registry"
)
