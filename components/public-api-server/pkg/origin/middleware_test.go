// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package origin

import (
	"context"
	"testing"

	"github.com/bufbuild/connect-go"
	"github.com/stretchr/testify/require"
)

func TestInterceptor_Unary(t *testing.T) {
	requestPaylaod := "request"
	origin := "my-origin"

	type response struct {
		origin string
	}

	handler := connect.UnaryFunc(func(ctx context.Context, ar connect.AnyRequest) (connect.AnyResponse, error) {
		origin := FromContext(ctx)
		return connect.NewResponse(&response{origin: origin}), nil
	})

	ctx := context.Background()
	request := connect.NewRequest(&requestPaylaod)
	request.Header().Add("Origin", origin)

	interceptor := NewInterceptor()
	resp, err := interceptor.WrapUnary(handler)(ctx, request)
	require.NoError(t, err)
	require.Equal(t, &response{origin: origin}, resp.Any())
}
