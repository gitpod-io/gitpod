// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package lib

import "regexp"

func CookieNameFromDomain(domain string) string {
	// replace all non-word characters with underscores
	derived := regexp.MustCompile(`[\W_]+`).ReplaceAllString(domain, "_")
	return "_" + derived + "_jwt2_"
}
