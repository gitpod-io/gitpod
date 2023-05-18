// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"crypto/md5"
	"fmt"
)

// Sanitiser turns a potentially sensitive value into a non-sensitive value
type Sanitisatiser func(value string) string

// SanitiseRedact sanitises a single value by replacing it with a fixed string
func SanitiseRedact(value string) string {
	return "[redacted]"
}

// SanitiseHash sanitises a single value by hashing it using MD5
func SanitiseHash(value string) string {
	hash := md5.New()
	_, _ = hash.Write([]byte(value))
	return fmt.Sprintf("[redacted:md5:%x]", hash.Sum(nil))
}
