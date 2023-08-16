// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	"path/filepath"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func NewEditorService(pool proxy.ServerConnectionPool) *EditorService {
	return &EditorService{
		connectionPool: pool,
	}
}

var _ v1connect.EditorServiceHandler = (*EditorService)(nil)

type EditorService struct {
	connectionPool proxy.ServerConnectionPool

	v1connect.UnimplementedEditorServiceHandler
}

func (s *WorkspaceService) ListEditorOptions(ctx context.Context, req *connect.Request[v1.ListEditorOptionsRequest]) (*connect.Response[v1.ListEditorOptionsResponse], error) {
	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	options, err := conn.GetIDEOptions(ctx)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to list editor options.")
		return nil, proxy.ConvertError(err)
	}

	convertedOptions := make([]*v1.EditorOption, 0, len(options.Options))
	for _, option := range options.Options {
		convertedOptions = append(convertedOptions, convertEditorOption(&option))
	}

	return connect.NewResponse(&v1.ListEditorOptionsResponse{
		Options: convertedOptions,
	}), nil
}

func convertEditorOption(ideOption *protocol.IDEOption) *v1.EditorOption {
	var editorType *v1.EditorOption_EditorType
	switch ideOption.Type {
	case "browser":
		editorType = v1.EditorOption_EDITOR_TYPE_BROWSER.Enum()
	case "desktop":
		editorType = v1.EditorOption_EDITOR_TYPE_DESKTOP.Enum()
	default:
		editorType = v1.EditorOption_EDITOR_TYPE_UNSPECIFIED.Enum()
	}

	return &v1.EditorOption{
		OrderKey: ideOption.OrderKey,
		Title:    ideOption.Title,
		Type:     *editorType,
		Logo:     ideOption.Logo,
		Label:    ideOption.Label,
		Version: &v1.EditorOption_Version{
			Stable: ideOption.ImageVersion,
			Latest: ideOption.LatestImageVersion,
		},
	}
}
