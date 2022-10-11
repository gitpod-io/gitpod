// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"testing"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
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
		connConstructor: func(token string) (gitpod.APIInterface, error) {
			return srv, nil
		},
	}

	_, err = pool.Get(context.Background(), "foo")
	require.NoError(t, err)
	require.Equal(t, 1, pool.cache.Len())

	_, err = pool.Get(context.Background(), "bar")
	require.NoError(t, err)
	require.Equal(t, 2, pool.cache.Len())

	_, err = pool.Get(context.Background(), "baz")
	require.NoError(t, err)
	require.Equal(t, 2, pool.cache.Len(), "must keep only last two connectons")
	require.True(t, pool.cache.Contains("bar"))
	require.True(t, pool.cache.Contains("baz"))
}
