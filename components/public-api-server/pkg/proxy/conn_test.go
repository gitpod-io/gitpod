// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"net/url"
	"testing"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/origin"
	"github.com/golang/mock/gomock"
	lru "github.com/hashicorp/golang-lru"
	"github.com/stretchr/testify/require"
)

func TestConnectionPool(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()
	srv := gitpod.NewMockAPIInterface(ctrl)

	cache, err := lru.New(2)
	require.NoError(t, err)
	pool := &ConnectionPool{
		cache: cache,
		connConstructor: func(ctx context.Context, token auth.Token) (gitpod.APIInterface, error) {
			return srv, nil
		},
	}

	fooToken := auth.NewAccessToken("foo")
	barToken := auth.NewAccessToken("bar")
	bazToken := auth.NewAccessToken("baz")

	_, err = pool.Get(context.Background(), fooToken)
	require.NoError(t, err)
	require.Equal(t, 1, pool.cache.Len())

	_, err = pool.Get(context.Background(), barToken)
	require.NoError(t, err)
	require.Equal(t, 2, pool.cache.Len())

	_, err = pool.Get(context.Background(), bazToken)
	require.NoError(t, err)
	require.Equal(t, 2, pool.cache.Len(), "must keep only last two connectons")
	require.True(t, pool.cache.Contains(pool.cacheKey(barToken, "")))
	require.True(t, pool.cache.Contains(pool.cacheKey(bazToken, "")))
}

func TestConnectionPool_ByDistinctOrigins(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()
	srv := gitpod.NewMockAPIInterface(ctrl)

	cache, err := lru.New(2)
	require.NoError(t, err)
	pool := &ConnectionPool{
		cache: cache,
		connConstructor: func(ctx context.Context, token auth.Token) (gitpod.APIInterface, error) {
			return srv, nil
		},
	}

	token := auth.NewAccessToken("foo")

	ctxWithOriginA := origin.ToContext(context.Background(), "originA")
	ctxWithOriginB := origin.ToContext(context.Background(), "originB")

	_, err = pool.Get(ctxWithOriginA, token)
	require.NoError(t, err)
	require.Equal(t, 1, pool.cache.Len())

	_, err = pool.Get(ctxWithOriginB, token)
	require.NoError(t, err)
	require.Equal(t, 2, pool.cache.Len())
}

func TestEndpointBasedOnToken(t *testing.T) {
	u, err := url.Parse("wss://server:3000")
	require.NoError(t, err)

	endpointForAccessToken, err := getEndpointBasedOnToken(auth.NewAccessToken("foo"), u)
	require.NoError(t, err)
	require.Equal(t, "wss://server:3000/v1", endpointForAccessToken)

	endpointForCookie, err := getEndpointBasedOnToken(auth.NewCookieToken("foo"), u)
	require.NoError(t, err)
	require.Equal(t, "wss://server:3000/gitpod", endpointForCookie)
}
