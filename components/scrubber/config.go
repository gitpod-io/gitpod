// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import "regexp"

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

	// HashedValues are regular expressions which - when matched - cause the entire value to be hashed
	HashedValues = map[string]*regexp.Regexp{
		// https://www.regular-expressions.info/email.html
		"email": regexp.MustCompile(`\A[a-z0-9!#$%&'*+/=?^_‘{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_‘{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\z`),
	}
)
