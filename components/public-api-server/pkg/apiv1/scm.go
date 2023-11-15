// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"

	connect "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
)

func NewSCMService(pool proxy.ServerConnectionPool) *SCMService {
	return &SCMService{
		connectionPool: pool,
	}
}

var _ v1connect.SCMServiceHandler = (*SCMService)(nil)

type SCMService struct {
	connectionPool proxy.ServerConnectionPool

	v1connect.UnimplementedSCMServiceHandler
}
