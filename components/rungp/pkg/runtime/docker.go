// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package runtime

import (
	"context"
	"io"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
)

type DockerRuntime struct{}

func (DockerRuntime) StartWorkspace(ctx context.Context, logs io.WriteCloser, workspaceImage string, cfg *gitpod.GitpodConfig) error {
	defer logs.Close()

	return nil
}
