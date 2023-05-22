// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"crypto/md5"
	"fmt"
)

// sanitiserOption provides additional options to a sanitiser
type SanitiserOption func(*sanitiserOptions)

// SanitiseWithKeyName adds the keyname as metadata to the sanitised value
func SanitiseWithKeyName(keyName string) SanitiserOption {
	return func(so *sanitiserOptions) {
		so.keyName = keyName
	}
}

type sanitiserOptions struct {
	keyName string
}

// Sanitiser turns a potentially sensitive value into a non-sensitive value
type Sanitisatiser func(value string, opts ...SanitiserOption) string

// SanitiseRedact sanitises a single value by replacing it with a fixed string
func SanitiseRedact(value string, opts ...SanitiserOption) string {
	options := mergeSanitiserOpts(opts)
	if options.keyName != "" {
		return "[redacted:" + options.keyName + "]"
	}
	return "[redacted]"
}

// SanitiseHash sanitises a single value by hashing it using MD5
func SanitiseHash(value string, opts ...SanitiserOption) string {
	options := mergeSanitiserOpts(opts)

	hash := md5.New()
	_, _ = hash.Write([]byte(value))

	res := fmt.Sprintf("[redacted:md5:%x", hash.Sum(nil))
	if options.keyName != "" {
		res += ":" + options.keyName
	}
	res += "]"
	return res
}

func mergeSanitiserOpts(opts []SanitiserOption) sanitiserOptions {
	var res sanitiserOptions
	for _, opt := range opts {
		opt(&res)
	}
	return res
}
