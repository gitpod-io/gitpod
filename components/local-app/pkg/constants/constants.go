// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package constants

var (
	// Version - set during build
	Version = "dev"

	// Flavor - set during build
	Flavor = "gitpod-cli"

	// KeychainServiceName - derived from Flavor
	KeychainServiceName string
)

func init() {
	if Flavor == "gitpod-cli" {
		KeychainServiceName = "gitpod-cli"
	} else {
		KeychainServiceName = "gitpod-io"
	}
}
