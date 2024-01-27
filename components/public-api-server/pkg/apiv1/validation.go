// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"errors"
	"fmt"
	"strings"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/namegen"
	"github.com/google/uuid"
	"github.com/relvacode/iso8601"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func validateTeamID(ctx context.Context, id string) (uuid.UUID, error) {
	log.AddFields(ctx, log.OrganizationID(id))
	teamID, err := validateUUID(id)
	if err != nil {
		return uuid.Nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Team ID must be a valid UUID."))
	}

	return teamID, nil
}

func parseGitpodTimeStampOrDefault(s string) *timestamppb.Timestamp {
	parsed, err := parseGitpodTimestamp(s)
	if err != nil {
		return &timestamppb.Timestamp{}
	}
	return parsed
}

func parseGitpodTimestamp(input string) (*timestamppb.Timestamp, error) {
	parsed, err := iso8601.ParseString(input)
	if err != nil {
		return nil, err
	}
	return timestamppb.New(parsed), nil
}

func validateWorkspaceID(ctx context.Context, id string) (string, error) {
	log.AddFields(ctx, log.WorkspaceID(id))
	if id == "" {
		return "", connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Empty workspace id specified"))
	}

	err := namegen.ValidateWorkspaceID(id)
	if err != nil {
		return "", connect.NewError(connect.CodeInvalidArgument, err)
	}

	return id, nil
}

func validateProjectID(ctx context.Context, id string) (uuid.UUID, error) {
	log.AddFields(ctx, log.ProjectID(id))
	projectID, err := validateUUID(id)
	if err != nil {
		return uuid.Nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Project ID must be a valid UUID."))
	}

	return projectID, nil
}

func validatePersonalAccessTokenID(ctx context.Context, id string) (uuid.UUID, error) {
	log.AddFields(ctx, log.PersonalAccessTokenID(id))
	tokenID, err := validateUUID(id)
	if err != nil {
		return uuid.Nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Token ID must be a valid UUID"))
	}

	return tokenID, nil
}

func validateOrganizationID(ctx context.Context, id string) (uuid.UUID, error) {
	log.AddFields(ctx, log.OrganizationID(id))
	organizationID, err := validateUUID(id)
	if err != nil {
		return uuid.Nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("OrganizationID must be a valid UUID"))
	}

	return organizationID, nil
}

func validateOIDCClientConfigID(ctx context.Context, id string) (uuid.UUID, error) {
	log.AddFields(ctx, log.OIDCClientConfigID(id))
	oidcClientConfigID, err := validateUUID(id)
	if err != nil {
		return uuid.Nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("OIDC Client Config ID must be a valid UUID"))
	}

	return oidcClientConfigID, nil
}

func validateFieldMask(mask *fieldmaskpb.FieldMask, message proto.Message) (*fieldmaskpb.FieldMask, error) {
	if mask == nil {
		return &fieldmaskpb.FieldMask{}, nil
	}

	mask.Normalize()
	if !mask.IsValid(message) {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("Invalid field mask specified."))
	}

	return mask, nil
}

func validateUUID(id string) (uuid.UUID, error) {
	trimmed := strings.TrimSpace(id)
	if trimmed == "" {
		return uuid.Nil, errors.New("empty uuid")
	}

	return uuid.Parse(trimmed)
}
