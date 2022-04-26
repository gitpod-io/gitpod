// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"io/ioutil"
	"testing"
)

func loadTLSCredentials() (credentials.TransportCredentials, error) {
	// Load certificate of the CA who signed server's certificate
	pemServerCA, err := ioutil.ReadFile("/workspace/gitpod/yolo/cert")
	if err != nil {
		return nil, err
	}

	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM(pemServerCA) {
		return nil, fmt.Errorf("failed to add server CA's certificate")
	}

	// Create the credentials and return it
	config := &tls.Config{
		RootCAs: certPool,
		CipherSuites: []uint16{
			tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		},
		CurvePreferences: []tls.CurveID{tls.X25519, tls.CurveP256},
		MinVersion:       tls.VersionTLS12,
		MaxVersion:       tls.VersionTLS12,
		NextProtos:       []string{"h2"},
	}

	return credentials.NewTLS(config), nil
}

func TestPublicAPIServer_v1(t *testing.T) {
	//t.SkipNow()
	ctx := context.Background()
	srv := baseserver.NewForTests(t)

	require.NoError(t, register(srv))
	baseserver.StartServerForTests(t, srv)

	tlsCredentials, err := loadTLSCredentials()
	require.NoError(t, err)

	addr := "api.mp-papi-caddy-grpc.preview.gitpod-dev.com:443"
	//addr := "localhost:9001"
	var opts []grpc.DialOption

	//opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	opts = append(opts, grpc.WithTransportCredentials(tlsCredentials))

	conn, err := grpc.Dial(addr, opts...)
	require.NoError(t, err)

	workspaceClient := v1.NewWorkspacesServiceClient(conn)

	_, err = workspaceClient.GetWorkspace(ctx, &v1.GetWorkspaceRequest{})
	requireErrorStatusCode(t, codes.Unimplemented, err)
}

func TestPublicAPIServer_v1_PrebuildService(t *testing.T) {
	ctx := context.Background()
	srv := baseserver.NewForTests(t)
	require.NoError(t, register(srv))

	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	prebuildClient := v1.NewPrebuildsServiceClient(conn)

	_, err = prebuildClient.GetPrebuild(ctx, &v1.GetPrebuildRequest{})
	requireErrorStatusCode(t, codes.Unimplemented, err)

	_, err = prebuildClient.GetRunningPrebuild(ctx, &v1.GetRunningPrebuildRequest{})
	requireErrorStatusCode(t, codes.Unimplemented, err)

	listenToStatusStream, err := prebuildClient.ListenToPrebuildStatus(ctx, &v1.ListenToPrebuildStatusRequest{})
	require.NoError(t, err)
	_, err = listenToStatusStream.Recv()
	requireErrorStatusCode(t, codes.Unimplemented, err)

	listenToLogsStream, err := prebuildClient.ListenToPrebuildLogs(ctx, &v1.ListenToPrebuildLogsRequest{})
	require.NoError(t, err)
	_, err = listenToLogsStream.Recv()
	requireErrorStatusCode(t, codes.Unimplemented, err)
}

func requireErrorStatusCode(t *testing.T, expected codes.Code, err error) {
	require.Error(t, err)
	st, ok := status.FromError(err)
	require.True(t, ok)
	require.Equalf(t, expected, st.Code(), "expected: %s but got: %s", expected.String(), st.String())
}
