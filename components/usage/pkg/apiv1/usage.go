// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
)

type UsageService struct {
	v1.UnimplementedUsageServiceServer
}

func NewUsageService() *UsageService {
	return &UsageService{}
}

func (u *UsageService) GetUsage(context.Context, *v1.GetUsageRequest) (*v1.GetUsageResponse, error) {
	return nil, fmt.Errorf("RPC not implemented")
}
