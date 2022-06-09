// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"io"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
)

type Result struct {
	Ref string
	Err error
}

type Builder interface {
	BaseBuilder
	WorkspaceImageBuilder
}

type BaseBuilder interface {
	BuildBaseImage(logs io.WriteCloser, cfg gitpod.ImageObject) (ref string, err error)
}

type WorkspaceImageBuilder interface {
	BuildWorkspaceImage(logs io.WriteCloser, baseRef string) (ref string, err error)
}
