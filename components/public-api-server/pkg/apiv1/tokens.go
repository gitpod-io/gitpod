// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"

func NewTokensService() *TokensService {
	return &TokensService{}
}

type TokensService struct {
	v1connect.UnimplementedTokensServiceHandler
}
