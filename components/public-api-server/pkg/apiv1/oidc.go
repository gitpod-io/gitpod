// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"

	connect "github.com/bufbuild/connect-go"
	goidc "github.com/coreos/go-oidc/v3/oidc"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"
)

func NewOIDCService(connPool proxy.ServerConnectionPool, expClient experiments.Client, dbConn *gorm.DB, cipher db.Cipher) *OIDCService {
	return &OIDCService{
		connectionPool: connPool,
		expClient:      expClient,
		cipher:         cipher,
		dbConn:         dbConn,
	}
}

type OIDCService struct {
	expClient      experiments.Client
	connectionPool proxy.ServerConnectionPool

	cipher db.Cipher
	dbConn *gorm.DB

	v1connect.UnimplementedOIDCServiceHandler
}

func (s *OIDCService) CreateClientConfig(ctx context.Context, req *connect.Request[v1.CreateClientConfigRequest]) (*connect.Response[v1.CreateClientConfigResponse], error) {
	organizationID, err := validateOrganizationID(req.Msg.Config.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	logger := log.WithField("organization_id", organizationID.String())

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	oauth2Config := req.Msg.GetConfig().GetOauth2Config()
	oidcConfig := req.Msg.GetConfig().GetOidcConfig()

	data, err := db.EncryptJSON(s.cipher, toDbOIDCSpec(oauth2Config, oidcConfig))
	if err != nil {
		logger.WithError(err).Error("Failed to encrypt oidc client config.")
		return nil, status.Errorf(codes.Internal, "Failed to store OIDC client config.")
	}

	created, err := db.CreateOIDCCLientConfig(ctx, s.dbConn, db.OIDCClientConfig{
		ID:             uuid.New(),
		OrganizationID: &organizationID,
		Issuer:         oidcConfig.GetIssuer(),
		Data:           data,
	})
	if err != nil {
		logger.WithError(err).Error("Failed to store oidc client config in the database.")
		return nil, status.Errorf(codes.Internal, "Failed to store OIDC client config.")
	}

	logger = log.WithField("oidc_client_config_id", created.ID.String())

	converted, err := dbOIDCClientConfigToAPI(created, s.cipher)
	if err != nil {
		logger.WithError(err).Error("Failed to convert OIDC Client config to response.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to convert OIDC Client Config %s for Organization %s to API response", created.ID.String(), organizationID.String()))
	}

	return connect.NewResponse(&v1.CreateClientConfigResponse{
		Config: converted,
	}), nil
}

func (s *OIDCService) GetClientConfig(ctx context.Context, req *connect.Request[v1.GetClientConfigRequest]) (*connect.Response[v1.GetClientConfigResponse], error) {
	organizationID, err := validateOrganizationID(req.Msg.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	clientConfigID, err := validateOIDCClientConfigID(req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	logger := log.WithField("oidc_client_config_id", clientConfigID.String()).WithField("organization_id", organizationID.String())

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	record, err := db.GetOIDCClientConfigForOrganization(ctx, s.dbConn, clientConfigID, organizationID)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("OIDC Client Config %s for Organization %s does not exist", clientConfigID.String(), organizationID.String()))
		}

		logger.WithError(err).Error("Failed to delete OIDC Client config.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to delete OIDC Client Config %s for Organization %s", clientConfigID.String(), organizationID.String()))
	}

	converted, err := dbOIDCClientConfigToAPI(record, s.cipher)
	if err != nil {
		logger.WithError(err).Error("Failed to convert OIDC Client config to response.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to convert OIDC Client Config %s for Organization %s to API response", clientConfigID.String(), organizationID.String()))
	}

	return connect.NewResponse(&v1.GetClientConfigResponse{
		Config: converted,
	}), nil
}

func (s *OIDCService) ListClientConfigs(ctx context.Context, req *connect.Request[v1.ListClientConfigsRequest]) (*connect.Response[v1.ListClientConfigsResponse], error) {
	organizationID, err := validateOrganizationID(req.Msg.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	configs, err := db.ListOIDCClientConfigsForOrganization(ctx, s.dbConn, organizationID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to retrieve oidc client configs"))
	}

	results, err := dbOIDCClientConfigsToAPI(configs, s.cipher)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to decrypt client configs"))
	}

	return connect.NewResponse(&v1.ListClientConfigsResponse{
		ClientConfigs: results,
		TotalResults:  int64(len(results)),
	}), nil
}

func (s *OIDCService) UpdateClientConfig(ctx context.Context, req *connect.Request[v1.UpdateClientConfigRequest]) (*connect.Response[v1.UpdateClientConfigResponse], error) {
	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.experimental.v1.OIDCService.UpdateClientConfig is not implemented"))
}

func (s *OIDCService) DeleteClientConfig(ctx context.Context, req *connect.Request[v1.DeleteClientConfigRequest]) (*connect.Response[v1.DeleteClientConfigResponse], error) {
	organizationID, err := validateOrganizationID(req.Msg.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	clientConfigID, err := validateOIDCClientConfigID(req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	logger := log.WithField("oidc_client_config_id", clientConfigID.String()).WithField("organization_id", organizationID.String())

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, _, err = s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	err = db.DeleteOIDCClientConfig(ctx, s.dbConn, clientConfigID, organizationID)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("OIDC Client Config %s for Organization %s does not exist", clientConfigID.String(), organizationID.String()))
		}

		logger.WithError(err).Error("Failed to delete OIDC Client config.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to delete OIDC Client Config %s for Organization %s", clientConfigID.String(), organizationID.String()))
	}

	return connect.NewResponse(&v1.DeleteClientConfigResponse{}), nil
}

func (s *OIDCService) getConnection(ctx context.Context) (protocol.APIInterface, error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Log.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to establish connection to downstream services. If this issue persists, please contact Gitpod Support."))
	}

	return conn, nil
}

func (s *OIDCService) getUser(ctx context.Context, conn protocol.APIInterface) (*protocol.User, uuid.UUID, error) {
	user, err := conn.GetLoggedInUser(ctx)
	if err != nil {
		return nil, uuid.Nil, proxy.ConvertError(err)
	}

	if !s.isFeatureEnabled(ctx, conn, user) {
		return nil, uuid.Nil, connect.NewError(connect.CodePermissionDenied, errors.New("This feature is currently in beta. If you would like to be part of the beta, please contact us."))
	}

	userID, err := uuid.Parse(user.ID)
	if err != nil {
		return nil, uuid.Nil, connect.NewError(connect.CodeInternal, errors.New("Failed to parse user ID as UUID. Please contact support."))
	}

	return user, userID, nil
}

func (s *OIDCService) isFeatureEnabled(ctx context.Context, conn protocol.APIInterface, user *protocol.User) bool {
	if user == nil {
		return false
	}

	if experiments.IsOIDCServiceEnabled(ctx, s.expClient, experiments.Attributes{UserID: user.ID}) {
		return true
	}

	teams, err := conn.GetTeams(ctx)
	if err != nil {
		log.WithError(err).Warnf("Failed to retreive Teams for user %s, personal access token feature flag will not evaluate team membership.", user.ID)
		teams = nil
	}
	for _, team := range teams {
		if experiments.IsOIDCServiceEnabled(ctx, s.expClient, experiments.Attributes{TeamID: team.ID}) {
			return true
		}
	}

	return false
}

func dbOIDCClientConfigToAPI(config db.OIDCClientConfig, decryptor db.Decryptor) (*v1.OIDCClientConfig, error) {
	decrypted, err := config.Data.Decrypt(decryptor)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt oidc client config: %w", err)
	}

	return &v1.OIDCClientConfig{
		Id:             config.ID.String(),
		OrganizationId: config.OrganizationID.String(),
		Oauth2Config: &v1.OAuth2Config{
			ClientId:              decrypted.ClientID,
			ClientSecret:          "REDACTED",
			AuthorizationEndpoint: decrypted.RedirectURL,
			Scopes:                decrypted.Scopes,
		},
	}, nil
}

func dbOIDCClientConfigsToAPI(configs []db.OIDCClientConfig, decryptor db.Decryptor) ([]*v1.OIDCClientConfig, error) {
	var results []*v1.OIDCClientConfig

	for _, c := range configs {
		res, err := dbOIDCClientConfigToAPI(c, decryptor)
		if err != nil {
			return nil, err
		}

		results = append(results, res)
	}

	return results, nil
}

func toDbOIDCSpec(oauth2Config *v1.OAuth2Config, oidcConfig *v1.OIDCConfig) db.OIDCSpec {
	return db.OIDCSpec{
		ClientID:     oauth2Config.GetClientId(),
		ClientSecret: oauth2Config.GetClientSecret(),
		RedirectURL:  oauth2Config.GetAuthorizationEndpoint(),
		Scopes:       append([]string{goidc.ScopeOpenID, "profile", "email"}, oauth2Config.GetScopes()...),
	}
}
