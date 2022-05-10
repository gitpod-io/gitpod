// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"errors"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"net/url"
	"testing"
)

func TestConnectionPoolWithMetrics(t *testing.T) {
	registry := prometheus.NewRegistry()
	RegisterMetrics(registry)

	address, err := url.Parse("http://gitpod.test.address.io")
	require.NoError(t, err)

	_, err = WrapConnectionPoolWithMetrics(&AlwaysNewConnectionPool{
		ServerAPI: address,
		constructor: func(endpoint string, opts gitpod.ConnectToServerOpts) (gitpod.APIInterface, error) {
			// We don't actually need the connection, so just returning an error
			return nil, errors.New("failed to create connection pool")
		},
	}).Get(context.Background(), "some-token")
	require.Error(t, err)

	count, err := testutil.GatherAndCount(registry, "gitpod_public_api_proxy_connection_create_duration_seconds")
	require.NoError(t, err)
	require.Equal(t, 1, count)

}

type MockConnectionPool struct {
	api gitpod.APIInterface
}

func (m *MockConnectionPool) Get(ctx context.Context, token string) (gitpod.APIInterface, error) {
	return m.api, nil
}
