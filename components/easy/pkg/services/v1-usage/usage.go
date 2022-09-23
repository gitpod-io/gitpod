// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v1_usage

import v1 "github.com/gitpod-io/gitpod/usage-api/v1"

type UsageService struct {
	v1.UnimplementedUsageServiceServer
}
