// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package blobserve_config

import "github.com/gitpod-io/gitpod/common-go/util"

// Config configures a server.
type BlobServe struct {
	Port    int             `json:"port"`
	Timeout util.Duration   `json:"timeout,omitempty"`
	Repos   map[string]Repo `json:"repos"`
	// AllowAnyRepo enables users to access any repo/image, irregardles if they're listed in the
	// ref config or not.
	AllowAnyRepo bool      `json:"allowAnyRepo"`
	BlobSpace    BlobSpace `json:"blobSpace"`
}

type StringReplacement struct {
	Path        string `json:"path"`
	Search      string `json:"search"`
	Replacement string `json:"replacement"`
}

type InlineReplacement struct {
	Search      string `json:"search"`
	Replacement string `json:"replacement"`
}

type Repo struct {
	PrePull      []string            `json:"prePull,omitempty"`
	Workdir      string              `json:"workdir,omitempty"`
	Replacements []StringReplacement `json:"replacements,omitempty"`
	InlineStatic []InlineReplacement `json:"inlineStatic,omitempty"`
}

type BlobSpace struct {
	Location string `json:"location"`
	MaxSize  int64  `json:"maxSizeBytes,omitempty"`
}
