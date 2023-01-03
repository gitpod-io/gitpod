// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	v1 "github.com/gitpod-io/gitpod/components/iam-api/go/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

func NewOIDCClientConfigService(dbConn *gorm.DB, cipher db.Cipher) *OIDCClientConfigService {
	return &OIDCClientConfigService{
		dbConn: dbConn,
		cipher: cipher,
	}
}

type OIDCClientConfigService struct {
	dbConn *gorm.DB
	cipher db.Cipher

	v1.UnimplementedOIDCServiceServer
}

func (s *OIDCClientConfigService) CreateClientConfig(ctx context.Context, req *v1.CreateClientConfigRequest) (*v1.CreateClientConfigResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CreateClientConfig not implemented")
}
