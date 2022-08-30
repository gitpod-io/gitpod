// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"context"
	"errors"
)

var notImplementedError = errors.New("not implemented")

type NoOpClient struct{}

func (c *NoOpClient) UploadUsageReport(ctx context.Context, filename string, report UsageReport) error {
	return notImplementedError
}

func (c *NoOpClient) DownloadUsageReport(ctx context.Context, filename string) (UsageReport, error) {
	return UsageReport{}, notImplementedError
}
