// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import "context"

type NoOpClient struct{}

func (c *NoOpClient) GetSignedUploadUrl(ctx context.Context) (string, error) { return "", nil }
