// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
)

// Config configures this service
type ServiceConfig struct {
	Server *baseserver.Configuration `json:"server"`

	DatabaseConfigPath string `json:"databaseConfigPath"`

	SessionServiceAddress string `json:"sessionServiceAddress"`

	OIDCClientsConfigFile string `json:"oidcClientsConfigFile,omitempty"`
}
