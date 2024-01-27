// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

var (
	NoAccessToken      = errors.New("missing access token")
	InvalidAccessToken = errors.New("invalid access token")
)

const bearerPrefix = "Bearer "
const authorizationHeaderKey = "Authorization"

func BearerTokenFromHeaders(h http.Header) (string, error) {
	authorization := strings.TrimSpace(h.Get(authorizationHeaderKey))
	if authorization == "" {
		return "", fmt.Errorf("empty authorization header: %w", NoAccessToken)
	}

	if !strings.HasPrefix(authorization, bearerPrefix) {
		return "", fmt.Errorf("authorization header does not have a Bearer prefix: %w", NoAccessToken)
	}

	return strings.TrimPrefix(authorization, bearerPrefix), nil
}
