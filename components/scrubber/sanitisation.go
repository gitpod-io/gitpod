// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scrubber

import (
	"crypto/md5"
	"fmt"
	"net/url"
	"strconv"
	"strings"
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

// SanitiseHashURLPathSegments hashes the URL paths separately using SanitiseHash
func SanitiseHashURLPathSegments(value string, opts ...SanitiserOption) string {
	options := mergeSanitiserOpts(opts)

	u, err := url.Parse(value)
	if err != nil {
		// cannot parse as URL, treat as string
		return SanitiseHash(value, opts...)
	}

	path := u.Path
	query := u.RawQuery
	u.Path = ""
	u.RawQuery = ""
	u.Fragment = ""

	pathSegmentAllowList := []string{
		"-",
		"blob",
		"blobs",
		"commit",
		"commits",
		"issue",
		"issues",
		"merge_request",
		"merge_requests",
		"pull-request",
		"pull-requests",
		"pull",
		"release",
		"releases",
		"src",
		"tag",
		"tags",
		"tree",
		// Bitbucket ENT-126
		"users",
		"projects",
		"scm",
		"repos",
		"browse",
		"branches",
	}

	var pathSegements []string
SEGMENTS:
	for _, p := range strings.Split(path, "/") {

		if len(p) <= 0 {
			continue SEGMENTS
		}

		if _, err := strconv.Atoi(p); err == nil {
			// it's a number, don't hash it
			pathSegements = append(pathSegements, p)
			continue SEGMENTS
		}

		p = strings.TrimPrefix(p, "~")
		p = strings.TrimSuffix(p, ".git")

		for _, a := range pathSegmentAllowList {
			if p == a {
				pathSegements = append(pathSegements, p)
				continue SEGMENTS
			}
		}

		pathSegements = append(pathSegements, SanitiseHash(p))
	}
	res := fmt.Sprintf("%s/%s", SanitiseHash(u.String()), strings.Join(pathSegements, "/"))
	if len(query) > 0 {
		res += fmt.Sprintf("?%s", SanitiseHash(query))
	}

	if options.keyName != "" {
		res += " [" + options.keyName + "]"
	}
	return res
}

func mergeSanitiserOpts(opts []SanitiserOption) sanitiserOptions {
	var res sanitiserOptions
	for _, opt := range opts {
		opt(&res)
	}
	return res
}
