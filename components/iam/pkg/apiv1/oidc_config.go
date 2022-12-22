// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	v1 "github.com/gitpod-io/gitpod/components/iam-api/go/v1"
)

func NewOIDCClientConfigService() *OIDCClientConfigService {
	return &OIDCClientConfigService{}
}

type OIDCClientConfigService struct {
	v1.UnimplementedOIDCServiceServer
}
