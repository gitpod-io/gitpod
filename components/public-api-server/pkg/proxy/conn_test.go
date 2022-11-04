// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"net/url"
	"testing"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
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
		connConstructor: func(token auth.Token) (gitpod.APIInterface, error) {
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
	require.True(t, pool.cache.Contains(barToken))
	require.True(t, pool.cache.Contains(bazToken))
}

func TestEndpointBasedOnToken(t *testing.T) {
	u, err := url.Parse("wss://gitpod.io")
	require.NoError(t, err)

	endpointForAccessToken, err := getEndpointBasedOnToken(auth.NewAccessToken("foo"), u)
	require.NoError(t, err)
	require.Equal(t, "wss://gitpod.io/api/v1", endpointForAccessToken)

	endpointForCookie, err := getEndpointBasedOnToken(auth.NewCookieToken("foo"), u)
	require.NoError(t, err)
	require.Equal(t, "wss://gitpod.io/api/gitpod", endpointForCookie)
}
