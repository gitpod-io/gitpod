// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"fmt"
	"net/http"

	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
	authzed "github.com/authzed/authzed-go/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	papi_config "github.com/gitpod-io/gitpod/components/public-api/go/config"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/util"
)

type SpiceDbAuthorizer struct {
	client *authzed.Client
}

func NewSpiceDbAuthorizer(cfg *papi_config.SpiceDbAuthorizerConfig) (*SpiceDbAuthorizer, error) {
	client, err := authzed.NewClient(
		cfg.Address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to setup create SpiceDbAuthorizer: %w", err)
	}
	return &SpiceDbAuthorizer{
		client,
	}, nil
}

func (a *SpiceDbAuthorizer) CheckPermissionOnOrganization(ctx context.Context, subjectId string, permission string, organizationId string) (bool, error) {
	resp, err := a.client.CheckPermission(ctx, &v1.CheckPermissionRequest{
		Subject:     subject(subjectId),
		Permission:  permission,
		Resource:    object("organization", organizationId),
		Consistency: consistency(),
	})
	if err != nil {
		return false, util.NewApplicationError(http.StatusForbidden, "Error while calling CheckPermission: %w", err)
	}
	return resp.Permissionship == v1.CheckPermissionResponse_PERMISSIONSHIP_HAS_PERMISSION, nil
}

func subject(subjectId string) *v1.SubjectReference {
	return &v1.SubjectReference{
		Object: &v1.ObjectReference{
			ObjectType: "user",
			ObjectId:   subjectId,
		},
	}
}

func object(objectType, objectId string) *v1.ObjectReference {
	return &v1.ObjectReference{
		ObjectType: objectType,
		ObjectId:   objectId,
	}
}

func consistency() *v1.Consistency {
	return &v1.Consistency{
		Requirement: &v1.Consistency_FullyConsistent{FullyConsistent: true},
	}
}
