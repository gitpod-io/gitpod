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
		"ssh",
		"private",
		"jwt",
		"secret",
		"email",
	}

	// HashedFieldNames name fields whose values we'll hash
	HashedFieldNames = []string{
		"contextURL",
		"metaID",
		"workspaceID",
		"username",
	}

	// HashedValues are regular expressions which - when matched - cause the entire value to be hashed
	HashedValues = map[string]*regexp.Regexp{}

	// RedactedValues are regular expressions which - when matched - cause the entire value to be redacted
	RedactedValues = map[string]*regexp.Regexp{
		// https://html.spec.whatwg.org/multipage/input.html#email-state-(type=email)
		"email": regexp.MustCompile(`[a-zA-Z0-9.!#$%&'*+\/=?^_` + "`" + `{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*`),
	}
)
