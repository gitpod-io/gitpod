// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws/jwstest"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"
)

func TestSCMService_GetSuggestedRepoURLs(t *testing.T) {
	t.Run("proxies request to server", func(t *testing.T) {
		serverMock, client := setupSCMService(t)

		str := ""
		serverMock.EXPECT().GetSuggestedContextURLs(gomock.Any()).Return([]*string{&str}, nil)

		retrieved, err := client.GetSuggestedRepoURLs(context.Background(), connect.NewRequest(&v1.GetSuggestedRepoURLsRequest{}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.GetSuggestedRepoURLsResponse{
			Repos: []string{""},
		}, retrieved.Msg)
	})
}

func setupSCMService(t *testing.T) (*protocol.MockAPIInterface, v1connect.SCMServiceClient) {
	t.Helper()

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewSCMService(&FakeServerConnPool{
		api: serverMock,
	})

	keyset := jwstest.GenerateKeySet(t)
	rsa256, err := jws.NewRSA256(keyset)
	require.NoError(t, err)

	_, handler := v1connect.NewSCMServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor(config.SessionConfig{
		Issuer: "unitetest.com",
		Cookie: config.CookieConfig{
			Name: "cookie_jwt",
		},
	}, rsa256)))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewSCMServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, client
}
