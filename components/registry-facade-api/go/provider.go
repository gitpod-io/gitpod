// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

const (
	// ProviderPrefixBase32 is the image repository prefix for base32 image spec.
	// Unlike the other prefixes this one is so short and undescriptive to fit as much data into the
	// 255 characters of a Docker repository name as possible.
	ProviderPrefixBase32 = "c"

	// ProviderPrefixRemote is the image repository prefix for remotely fetched image specs
	ProviderPrefixRemote = "remote"
)
