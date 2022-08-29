// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
)

type Interface interface {
	UploadUsageReport(ctx context.Context, filename string, report db.UsageReport) error
	DownloadUsageReport(ctx context.Context, filename string) (db.UsageReport, error)
}

type Client struct {
	service api.UsageReportServiceClient
}

func New(service api.UsageReportServiceClient) *Client {
	return &Client{service: service}
}

func (c *Client) UploadUsageReport(ctx context.Context, filename string, report db.UsageReport) error {
	uploadURLResp, err := c.service.UploadURL(ctx, &api.UsageReportUploadURLRequest{Name: filename})
	if err != nil {
		return fmt.Errorf("failed to get upload URL from usage report service: %w", err)
	}

	reportBytes := &bytes.Buffer{}
	gz := gzip.NewWriter(reportBytes)
	err = json.NewEncoder(gz).Encode(report)
	if err != nil {
		return fmt.Errorf("failed to marshal report to JSON: %w", err)
	}
	err = gz.Close()
	if err != nil {
		return fmt.Errorf("failed to compress usage report: %w", err)
	}

	req, err := http.NewRequest(http.MethodPut, uploadURLResp.GetUrl(), reportBytes)
	if err != nil {
		return fmt.Errorf("failed to construct http request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
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

func (c *Client) DownloadUsageReport(ctx context.Context, filename string) (db.UsageReport, error) {
	downloadURlResp, err := c.service.DownloadURL(ctx, &api.UsageReportDownloadURLRequest{
		Name: filename,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get download URL: %w", err)
	}

	req, err := http.NewRequest(http.MethodGet, downloadURlResp.GetUrl(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to construct request: %w", err)
	}

	// We want to receive it as gzip, this disables transcoding of the response
	req.Header.Set("Accept-Encoding", "gzip")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request to download usage report: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request to download usage report returned non 200 status code: %d", resp.StatusCode)
	}

	body := resp.Body
	defer body.Close()

	decompressor, err := gzip.NewReader(body)
	if err != nil {
		return nil, fmt.Errorf("failed to construct gzip decompressor from response: %w", err)
	}
	defer decompressor.Close()

	decoder := json.NewDecoder(body)
	var records []db.WorkspaceInstanceUsage
	if err := decoder.Decode(&records); err != nil {
		return nil, fmt.Errorf("failed to deserialize report: %w", err)
	}

	return records, nil
}
