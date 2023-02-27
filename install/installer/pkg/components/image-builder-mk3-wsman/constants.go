// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package image_builder_mk3_wsman

import "github.com/gitpod-io/gitpod/installer/pkg/common"

const (
	BuilderImage        = "image-builder-mk3/bob"
	Component           = "image-builder-mk3-wsman"
	RPCPort             = common.ImageBuilderRPCPort
	RPCPortName         = "service"
	TLSSecretName       = common.ImageBuilderTLSSecret
	VolumeTLSCerts      = common.ImageBuilderVolumeTLSCerts
	TLSSecretNameWsman  = common.ImageBuilderTLSSecretWsman
	VolumeTLSCertsWsman = common.ImageBuilderVolumeTLSCertsWsman
)
