// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"context"
	"log/slog"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
)

// InferOrgId returns the organization ID to use if there is only one org available.
func InferOrgId() (string, error) {
	ctx := context.Background()
	gitpod, err := GetGitpodClient(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to setup Gitpod API client", err)
	}

	orgsList, err := gitpod.Teams.ListTeams(ctx, connect.NewRequest(&v1.ListTeamsRequest{}))

	if err != nil {
		slog.ErrorContext(ctx, "Failed to list organizations", err)
		return "", err
	}

	orgIds := []string{}
	for _, org := range orgsList.Msg.GetTeams() {
		orgIds = append(orgIds, org.Id)
	}

	if len(orgIds) == 0 {
		slog.Error("No organization found")
		return "", nil
	}

	if len(orgIds) == 1 {
		slog.Debug("Only one organization found, automatically selecting it")
		return orgIds[0], nil
	}

	return "", nil
}
