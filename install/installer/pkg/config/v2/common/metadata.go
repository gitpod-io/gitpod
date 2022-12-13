// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

type Metadata struct {
	// Location for your objectStorage provider
	Region string `json:"region" validate:"required"`
	// InstallationShortname establishes the "identity" of the (application) cluster.
	InstallationShortname string `json:"shortname"`
}
