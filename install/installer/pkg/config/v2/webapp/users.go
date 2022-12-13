// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package webapp

type BlockNewUsers struct {
	Enabled bool `json:"enabled"`
	// Passlist []string `json:"passlist" validate:"min=1,unique,dive,fqdn"`
	Passlist []string `json:"passlist" validate:"block_new_users_passlist"`
}
