// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"

	goidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	v1 "github.com/gitpod-io/gitpod/components/iam-api/go/v1"
	"github.com/google/uuid"
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
	organizationID, err := validateOrganizationID(req.GetConfig().GetOrganizationId())
	if err != nil {
		return nil, err
	}

	oauth2Config := req.GetConfig().GetOauth2Config()
	oidcConfig := req.GetConfig().GetOidcConfig()

	data, err := db.EncryptJSON(s.cipher, toDBSpec(oauth2Config, oidcConfig))
	if err != nil {
		log.Log.WithError(err).Error("Failed to encrypt oidc client config.")
		return nil, status.Errorf(codes.Internal, "Failed to store OIDC client config.")
	}

	created, err := db.CreateOIDCCLientConfig(ctx, s.dbConn, db.OIDCClientConfig{
		ID:             uuid.New(),
		OrganizationID: &organizationID,
		Issuer:         oidcConfig.GetIssuer(),
		Data:           data,
	})
	if err != nil {
		log.Log.WithError(err).Error("Failed to store oidc client config in the database.")
		return nil, status.Errorf(codes.Internal, "Failed to store OIDC client config.")
	}

	return &v1.CreateClientConfigResponse{
		Config: oidcClientConfigToProto(created),
	}, nil
}

func (s *OIDCClientConfigService) GetClientConfig(ctx context.Context, req *v1.GetClientConfigRequest) (*v1.GetClientConfigResponse, error) {
	id, err := validateOIDCSpecID(req.GetId())
	if err != nil {
		return nil, err
	}

	oidcConfig, err := db.GetOIDCClientConfig(ctx, s.dbConn, id)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, status.Errorf(codes.NotFound, "no oidc config with ID: %s exists", id.String())
		}
	}

	return &v1.GetClientConfigResponse{
		Config: oidcClientConfigToProto(oidcConfig),
	}, nil
}

func validateOIDCSpecID(id string) (uuid.UUID, error) {
	parsed, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, status.Errorf(codes.InvalidArgument, "invalid oidc spec ID, must be a UUID")
	}

	return parsed, nil
}

func toDBSpec(oauth2Config *v1.OAuth2Config, oidcConfig *v1.OIDCConfig) db.OIDCSpec {
	return db.OIDCSpec{
		ClientID:     oauth2Config.GetClientId(),
		ClientSecret: oauth2Config.GetClientSecret(),
		RedirectURL:  oauth2Config.GetAuthorizationEndpoint(),
		Scopes:       append([]string{goidc.ScopeOpenID, "profile", "email"}, oauth2Config.GetScopes()...),
	}
}

func oidcClientConfigToProto(cfg db.OIDCClientConfig) *v1.OIDCClientConfig {
	var organizationID string
	if cfg.OrganizationID != nil {
		organizationID = cfg.OrganizationID.String()
	}

	return &v1.OIDCClientConfig{
		Id:             cfg.ID.String(),
		OrganizationId: organizationID,
		// TODO: Populate remainder of fields
	}
}

func validateOrganizationID(id string) (uuid.UUID, error) {
	organizationID, err := uuid.Parse(id)
	if err != nil {
		return uuid.Nil, status.Error(codes.InvalidArgument, "invalid organization id, must be a UUID")
	}

	return organizationID, nil
}
