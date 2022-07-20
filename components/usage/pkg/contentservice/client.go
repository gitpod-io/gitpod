// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/api"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Interface interface {
	UploadFile(ctx context.Context, filename string, body io.Reader) error
}

type Client struct {
	url string
}

func New(url string) *Client {
	return &Client{url: url}
}

func (c *Client) UploadFile(ctx context.Context, filename string, body io.Reader) error {
	url, err := c.getSignedUploadUrl(ctx, filename)
	if err != nil {
		return fmt.Errorf("failed to obtain signed upload URL: %w", err)
	}

	req, err := http.NewRequest(http.MethodPut, url, body)
	if err != nil {
		return fmt.Errorf("failed to construct http request: %w", err)
	}

	req.Header.Set("Content-Encoding", "gzip")

	log.Infof("Uploading %q to object storage...", filename)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make http request: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected http response code: %s", resp.Status)
	}
	log.Info("Upload complete")

	return nil
}

func (c *Client) getSignedUploadUrl(ctx context.Context, key string) (string, error) {
	conn, err := grpc.Dial(c.url, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return "", fmt.Errorf("failed to dial content-service gRPC server: %w", err)
	}
	defer conn.Close()

	uc := api.NewUsageReportServiceClient(conn)

	resp, err := uc.UploadURL(ctx, &api.UsageReportUploadURLRequest{Name: key})
	if err != nil {
		return "", fmt.Errorf("failed RPC to content service: %w", err)
	}

	return resp.Url, nil
}
