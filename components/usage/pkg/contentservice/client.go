// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"context"
	"fmt"

	"github.com/gitpod-io/gitpod/content-service/api"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Interface interface {
	GetSignedUploadUrl(ctx context.Context) (string, error)
}

type Client struct {
	url string
}

func New(url string) *Client {
	return &Client{url: url}
}

func (c *Client) GetSignedUploadUrl(ctx context.Context) (string, error) {
	conn, err := grpc.Dial(c.url, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return "", fmt.Errorf("failed to dial content-service gRPC server: %w", err)
	}
	defer conn.Close()

	uc := api.NewUsageReportServiceClient(conn)

	resp, err := uc.UploadURL(ctx, &api.UsageReportUploadURLRequest{Name: "some-name"})
	if err != nil {
		return "", fmt.Errorf("failed to obtain signed upload URL: %w", err)
	}

	return resp.Url, nil
}
