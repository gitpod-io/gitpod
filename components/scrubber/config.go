// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

var (
	// RedactedFieldNames are the names of fields we'll redact
	RedactedFieldNames = []string{
		"auth_",
		"password",
		"token",
		"key",
		"jwt",
		"secret",
	}

	// HashedFieldNames name fields whose values we'll hash
	HashedFieldNames = []string{
		"workspaceId",
		"workspaceID",
		"username",
		"email",
	}
)
