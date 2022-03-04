// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package storage

import (
	"context"
	"net/http"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
)

// NamedURLDownloader offers downloads from fixed URLs
type NamedURLDownloader struct {
	URLs map[string]string
}

// Download takes the latest state from the remote storage and downloads it to a local path
func (d *NamedURLDownloader) Download(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (found bool, err error) {
	url, found := d.URLs[name]
	if !found {
		return false, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}
	if resp.StatusCode == http.StatusFound {
		return false, nil
	}
	if resp.StatusCode != http.StatusOK {
		return false, xerrors.Errorf("non-OK status code: %v", resp.StatusCode)
	}
	defer resp.Body.Close()

	err = extractTarbal(ctx, destination, resp.Body, mappings)
	if err != nil {
		return true, err
	}

	return true, nil
}

// DownloadSnapshot downloads a snapshot.
func (d *NamedURLDownloader) DownloadSnapshot(ctx context.Context, destination string, name string, mappings []archive.IDMapping) (found bool, err error) {
	return d.Download(ctx, destination, name, mappings)
}
