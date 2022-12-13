// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package webapp

import (
	"github.com/gitpod-io/gitpod/installer/pkg/config/v2/common"
)

type Config struct {
	Database       Database         `json:"database" validate:"required"`
	TLSCertificate common.ObjectRef `json:"certificate" validate:"required"`

	AuthProviders []common.ObjectRef `json:"authProviders" validate:"dive"`
	BlockNewUsers BlockNewUsers      `json:"blockNewUsers"`
	License       *common.ObjectRef  `json:"license,omitempty"`

	SSHGatewayHostKey *common.ObjectRef `json:"sshGatewayHostKey,omitempty"`

	DisableDefinitelyGP bool `json:"disableDefinitelyGp"`
}
