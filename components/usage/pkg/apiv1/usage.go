// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	context "context"

	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
)

var _ v1.UsageServiceServer = (*UsageService)(nil)

type UsageService struct {
	v1.UnimplementedUsageServiceServer
}

func (us *UsageService) GetBilledUsage(ctx context.Context, in *v1.GetBilledUsageRequest) (*v1.GetBilledUsageResponse, error) {
	// TODO(geropl) Dummy data for now
	response := v1.GetBilledUsageResponse{}
	return &response, nil
}

func NewUsageService() *UsageService {
	return &UsageService{}
}
