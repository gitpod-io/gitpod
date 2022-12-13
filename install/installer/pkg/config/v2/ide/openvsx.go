// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide

type OpenVSX struct {
	URL   string `json:"url" validate:"url"`
	Proxy *Proxy `json:"proxy,omitempty"`
}

type Proxy struct {
	DisablePVC bool `json:"disablePVC"`
}
