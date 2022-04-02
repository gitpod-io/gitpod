// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestOptions(t *testing.T) {
	logger := log.New()
	httpPort := 8080
	grpcPort := 8081
	timeout := 10 * time.Second
	hostname := "another_hostname"

	var opts = []Option{
		WithHostname(hostname),
		WithHTTPPort(httpPort),
		WithGRPCPort(grpcPort),
		WithLogger(logger),
		WithCloseTimeout(timeout),
	}
	cfg, err := evaluateOptions(defaultConfig(), opts...)
	require.NoError(t, err)

	require.Equal(t, &config{
		logger:       logger,
		hostname:     hostname,
		grpcPort:     grpcPort,
		httpPort:     httpPort,
		closeTimeout: timeout,
	}, cfg)
}

func TestWithTTPPort_ErrorsWithNegativePort(t *testing.T) {
	_, err := evaluateOptions(defaultConfig(), WithHTTPPort(-1))
	require.Error(t, err)
}

func TestWithGRPCPort_ErrorsWithNegativePort(t *testing.T) {
	_, err := evaluateOptions(defaultConfig(), WithGRPCPort(-1))
	require.Error(t, err)
}

func TestLogger_ErrorsWithNilLogger(t *testing.T) {
	_, err := evaluateOptions(defaultConfig(), WithLogger(nil))
	require.Error(t, err)
}
