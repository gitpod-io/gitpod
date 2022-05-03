// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import "net/url"

type Config struct {
	GitpodAPI *url.URL

	HTTPPort int
	GRPCPort int
}
