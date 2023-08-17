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

func TestEditorService_ListEditorOptions(t *testing.T) {
	t.Run("proxies request to server", func(t *testing.T) {
		serverMock, client := setupEditorService(t)

		serverMock.EXPECT().GetIDEOptions(gomock.Any()).Return(&protocol.IDEOptions{Options: map[string]protocol.IDEOption{
			"code": {
				OrderKey:           "02",
				Title:              "VS Code",
				Logo:               "https://gitpod.io/icons/vscode.svg",
				ImageVersion:       "1.68.0",
				LatestImageVersion: "1.69.0",
			},
			"theia": {
				OrderKey:     "01",
				Title:        "Theia",
				Logo:         "https://gitpod.io/icons/theia.svg",
				ImageVersion: "1.68.0",
			},
		}, DefaultIde: "", DefaultDesktopIde: "", Clients: map[string]protocol.IDEClient{}}, nil)

		retrieved, err := client.ListEditorOptions(context.Background(), connect.NewRequest(&v1.ListEditorOptionsRequest{}))
		require.NoError(t, err)
		requireEqualProto(t, &v1.ListEditorOptionsResponse{
			Options: []*v1.EditorOption{
				{
					Title: "Theia",
					Id:    "theia",
					Logo:  "https://gitpod.io/icons/theia.svg",
					Stable: &v1.EditorOption_Kind{
						Version: "1.68.0",
					},
					Latest: &v1.EditorOption_Kind{},
				},
				{
					Title: "VS Code",
					Id:    "code",
					Logo:  "https://gitpod.io/icons/vscode.svg",
					Stable: &v1.EditorOption_Kind{
						Version: "1.68.0",
					},
					Latest: &v1.EditorOption_Kind{
						Version: "1.69.0",
					},
				},
			},
		}, retrieved.Msg)
	})
}

func setupEditorService(t *testing.T) (*protocol.MockAPIInterface, v1connect.EditorServiceClient) {
	t.Helper()

	ctrl := gomock.NewController(t)
	t.Cleanup(ctrl.Finish)

	serverMock := protocol.NewMockAPIInterface(ctrl)

	svc := NewEditorService(&FakeServerConnPool{
		api: serverMock,
	})

	keyset := jwstest.GenerateKeySet(t)
	rsa256, err := jws.NewRSA256(keyset)
	require.NoError(t, err)

	_, handler := v1connect.NewEditorServiceHandler(svc, connect.WithInterceptors(auth.NewServerInterceptor(config.SessionConfig{
		Issuer: "unitetest.com",
		Cookie: config.CookieConfig{
			Name: "cookie_jwt",
		},
	}, rsa256)))

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	client := v1connect.NewEditorServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(
		auth.NewClientInterceptor("auth-token"),
	))

	return serverMock, client
}
