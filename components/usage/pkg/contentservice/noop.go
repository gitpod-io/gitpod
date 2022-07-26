// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"context"

	"github.com/gitpod-io/gitpod/usage/pkg/db"
)

type NoOpClient struct{}

func (c *NoOpClient) UploadUsageReport(ctx context.Context, filename string, report []db.WorkspaceInstanceUsage) error {
	return nil
}
