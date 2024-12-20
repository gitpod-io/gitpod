// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

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
	organizationID, err := validateOrganizationID(ctx, req.Msg.Config.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	if authorizationErr := s.userIsOrgOwner(ctx, userID, organizationID); authorizationErr != nil {
		return nil, authorizationErr
	}

	config := req.Msg.GetConfig()
	oidcConfig := config.GetOidcConfig()

	issuer, err := validateIssuerURL(oidcConfig.GetIssuer())
	if err != nil {
		return nil, err
	}

	err = assertIssuerIsReachable(ctx, issuer)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	err = assertIssuerProvidesDiscovery(ctx, issuer)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	oauth2Config := config.GetOauth2Config()
	data, err := db.EncryptJSON(s.cipher, toDbOIDCSpec(oauth2Config))
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to encrypt oidc client config.")
		return nil, status.Errorf(codes.Internal, "Failed to store OIDC client config.")
	}

	active := config.GetActive()

	created, err := db.CreateOIDCClientConfig(ctx, s.dbConn, db.OIDCClientConfig{
		ID:             uuid.New(),
		OrganizationID: organizationID,
		Issuer:         issuer.String(),
		Data:           data,
		Active:         active,
	})
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to store oidc client config in the database.")
		return nil, status.Errorf(codes.Internal, "Failed to store OIDC client config.")
	}

	log.AddFields(ctx, log.OIDCClientConfigID(created.ID.String()))

	converted, err := dbOIDCClientConfigToAPI(created, s.cipher)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to convert OIDC Client config to response.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to convert OIDC Client Config %s for Organization %s to API response", created.ID.String(), organizationID.String()))
	}

	return connect.NewResponse(&v1.CreateClientConfigResponse{
		Config: converted,
	}), nil
}

func (s *OIDCService) GetClientConfig(ctx context.Context, req *connect.Request[v1.GetClientConfigRequest]) (*connect.Response[v1.GetClientConfigResponse], error) {
	organizationID, err := validateOrganizationID(ctx, req.Msg.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	clientConfigID, err := validateOIDCClientConfigID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	if authorizationErr := s.userIsOrgOwner(ctx, userID, organizationID); authorizationErr != nil {
		return nil, authorizationErr
	}

	record, err := db.GetOIDCClientConfigForOrganization(ctx, s.dbConn, clientConfigID, organizationID)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("OIDC Client Config %s for Organization %s does not exist", clientConfigID.String(), organizationID.String()))
		}

		log.Extract(ctx).WithError(err).Error("Failed to delete OIDC Client config.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to delete OIDC Client Config %s for Organization %s", clientConfigID.String(), organizationID.String()))
	}

	converted, err := dbOIDCClientConfigToAPI(record, s.cipher)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to convert OIDC Client config to response.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to convert OIDC Client Config %s for Organization %s to API response", clientConfigID.String(), organizationID.String()))
	}

	return connect.NewResponse(&v1.GetClientConfigResponse{
		Config: converted,
	}), nil
}

func (s *OIDCService) ListClientConfigs(ctx context.Context, req *connect.Request[v1.ListClientConfigsRequest]) (*connect.Response[v1.ListClientConfigsResponse], error) {
	organizationID, err := validateOrganizationID(ctx, req.Msg.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	if authorizationErr := s.userIsOrgOwner(ctx, userID, organizationID); authorizationErr != nil {
		return nil, authorizationErr
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
	config := req.Msg.GetConfig()

	clientConfigID, err := validateOIDCClientConfigID(ctx, config.GetId())
	if err != nil {
		return nil, err
	}

	organizationID, err := validateOrganizationID(ctx, config.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	if authorizationErr := s.userIsOrgOwner(ctx, userID, organizationID); authorizationErr != nil {
		return nil, authorizationErr
	}

	oidcConfig := config.GetOidcConfig()
	oauth2Config := config.GetOauth2Config()

	issuer := ""
	if oidcConfig.GetIssuer() != "" {
		// If we're updating the issuer, let's also check for reachability
		issuerURL, err := validateIssuerURL(oidcConfig.GetIssuer())
		if err != nil {
			return nil, err
		}

		err = assertIssuerIsReachable(ctx, issuerURL)
		if err != nil {
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		}

		issuer = issuerURL.String()
	}

	updateSpec := toDbOIDCSpec(oauth2Config)

	if err := db.UpdateOIDCClientConfig(ctx, s.dbConn, s.cipher, db.OIDCClientConfig{
		ID:     clientConfigID,
		Issuer: issuer,
	}, &updateSpec); err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("OIDC Client Config %s does not exist", clientConfigID.String()))
		}

		log.Extract(ctx).WithError(err).Error("Failed to update OIDC Client config.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to update OIDC Client Config %s", clientConfigID.String()))
	}

	return connect.NewResponse(&v1.UpdateClientConfigResponse{}), nil
}

func (s *OIDCService) DeleteClientConfig(ctx context.Context, req *connect.Request[v1.DeleteClientConfigRequest]) (*connect.Response[v1.DeleteClientConfigResponse], error) {
	organizationID, err := validateOrganizationID(ctx, req.Msg.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	clientConfigID, err := validateOIDCClientConfigID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	if authorizationErr := s.userIsOrgOwner(ctx, userID, organizationID); authorizationErr != nil {
		return nil, authorizationErr
	}

	err = db.DeleteOIDCClientConfig(ctx, s.dbConn, clientConfigID, organizationID)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("OIDC Client Config %s for Organization %s does not exist", clientConfigID.String(), organizationID.String()))
		}

		log.Extract(ctx).WithError(err).Error("Failed to delete OIDC Client config.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to delete OIDC Client Config %s for Organization %s", clientConfigID.String(), organizationID.String()))
	}

	return connect.NewResponse(&v1.DeleteClientConfigResponse{}), nil
}

func (s *OIDCService) SetClientConfigActivation(ctx context.Context, req *connect.Request[v1.SetClientConfigActivationRequest]) (*connect.Response[v1.SetClientConfigActivationResponse], error) {
	organizationID, err := validateOrganizationID(ctx, req.Msg.GetOrganizationId())
	if err != nil {
		return nil, err
	}

	clientConfigID, err := validateOIDCClientConfigID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	conn, err := s.getConnection(ctx)
	if err != nil {
		return nil, err
	}

	_, userID, err := s.getUser(ctx, conn)
	if err != nil {
		return nil, err
	}

	if authorizationErr := s.userIsOrgOwner(ctx, userID, organizationID); authorizationErr != nil {
		return nil, authorizationErr
	}

	config, err := db.GetOIDCClientConfig(ctx, s.dbConn, clientConfigID)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("OIDC Client Config %s for Organization %s does not exist", clientConfigID.String(), organizationID.String()))
		}

		return nil, err
	}

	if req.Msg.Activate {
		if config.Verified == nil || !*config.Verified {
			log.Extract(ctx).WithError(err).Error("Failed to activate an unverified OIDC Client Config.")
			return nil, connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf("Failed to activate an unverified OIDC Client Config %s for Organization %s", clientConfigID.String(), organizationID.String()))
		}
	}

	err = db.SetClientConfigActiviation(ctx, s.dbConn, clientConfigID, req.Msg.Activate)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to set OIDC Client Config activation.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to set OIDC Client Config activation (ID: %s) for Organization %s", clientConfigID.String(), organizationID.String()))
	}

	return connect.NewResponse(&v1.SetClientConfigActivationResponse{}), nil
}

func (s *OIDCService) getConnection(ctx context.Context) (protocol.APIInterface, error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	conn, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, errors.New("Failed to establish connection to downstream services. If this issue persists, please contact Gitpod Support."))
	}

	return conn, nil
}

func (s *OIDCService) getUser(ctx context.Context, conn protocol.APIInterface) (*protocol.User, uuid.UUID, error) {
	user, err := conn.GetLoggedInUser(ctx)
	if err != nil {
		return nil, uuid.Nil, proxy.ConvertError(err)
	}

	log.AddFields(ctx, log.UserID(user.ID))

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
		log.Extract(ctx).WithError(err).Warnf("Failed to retreive Teams for user %s, personal access token feature flag will not evaluate team membership.", user.ID)
		teams = nil
	}
	for _, team := range teams {
		if experiments.IsOIDCServiceEnabled(ctx, s.expClient, experiments.Attributes{TeamID: team.ID}) {
			return true
		}
	}

	return false
}

func (s *OIDCService) userIsOrgOwner(ctx context.Context, userID, orgID uuid.UUID) error {
	membership, err := db.GetOrganizationMembership(ctx, s.dbConn, userID, orgID)
	if err != nil {
		if errors.Is(err, db.ErrorNotFound) {
			return connect.NewError(connect.CodeNotFound, fmt.Errorf("Organization %s does not exist", orgID.String()))
		}

		return connect.NewError(connect.CodeInternal, fmt.Errorf("Failed to verify user %s is owner of organization %s", userID.String(), orgID.String()))
	}

	if membership.Role != db.OrganizationMembershipRole_Owner {
		return connect.NewError(connect.CodePermissionDenied, fmt.Errorf("user %s is not owner of organization %s", userID.String(), orgID.String()))
	}

	return nil
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
			CelExpression:         decrypted.CelExpression,
			UsePkce:               decrypted.UsePKCE,
		},
		OidcConfig: &v1.OIDCConfig{
			Issuer: config.Issuer,
		},
		Active:   config.Active,
		Verified: config.Verified != nil && *config.Verified,
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

func toDbOIDCSpec(oauth2Config *v1.OAuth2Config) db.OIDCSpec {
	return db.OIDCSpec{
		ClientID:      oauth2Config.GetClientId(),
		ClientSecret:  oauth2Config.GetClientSecret(),
		CelExpression: oauth2Config.GetCelExpression(),
		UsePKCE:       oauth2Config.GetUsePkce(),
		RedirectURL:   oauth2Config.GetAuthorizationEndpoint(),
		Scopes:        append([]string{goidc.ScopeOpenID, "profile", "email"}, oauth2Config.GetScopes()...),
	}
}

func assertIssuerIsReachable(ctx context.Context, issuer *url.URL) error {
	tr := &http.Transport{
		// TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		Proxy: http.ProxyFromEnvironment,
	}
	client := &http.Client{
		Transport: tr,
		Timeout:   2 * time.Second,
		// never follow redirects
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, issuer.String()+"/.well-known/openid-configuration", nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode > 499 {
		return fmt.Errorf("returned status %d", resp.StatusCode)
	}
	return nil
}

func assertIssuerProvidesDiscovery(ctx context.Context, issuer *url.URL) error {
	tr := &http.Transport{
		// TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		Proxy: http.ProxyFromEnvironment,
	}
	client := &http.Client{
		Transport: tr,

		// never follow redirects
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, issuer.String()+"/.well-known/openid-configuration", nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("The identity providers needs to support OIDC Discovery.")
	}
	if !strings.Contains(resp.Header.Get("Content-Type"), "application/json") {
		return fmt.Errorf("OIDC Discovery configuration is of unexpected content type.")
	}

	var config map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&config)
	if err != nil {
		return fmt.Errorf("OIDC Discovery configuration is not parsable.")
	}
	return nil
}

func validateIssuerURL(issuer string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSuffix(issuer, "/"))
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Issuer must contain a valid URL"))
	}

	return parsed, nil
}
