// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"context"
	"io"
)

type NoOpClient struct{}

func (c *NoOpClient) UploadFile(ctx context.Context, filename string, body io.Reader) error {
	return nil
}
