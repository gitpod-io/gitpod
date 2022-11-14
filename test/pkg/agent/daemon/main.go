// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	cgroups_v2 "github.com/gitpod-io/gitpod/common-go/cgroups/v2"
	ctntcfg "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/test/pkg/agent/daemon/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func main() {
	done := make(chan struct{})
	go func() {
		mux := http.NewServeMux()
		mux.Handle("/shutdown", shugtdownHandler(done))
		_ = http.ListenAndServe(":8080", mux)
	}()
	integration.ServeAgent(done, new(DaemonAgent))
}

func shugtdownHandler(done chan struct{}) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		close(done)
		w.Write([]byte("shutdown"))
		w.WriteHeader(http.StatusOK)
	}
}

type daemonConfig struct {
	Daemon struct {
		Content struct {
			Storage ctntcfg.StorageConfig `json:"storage"`
		} `json:"content"`
	} `json:"daemon"`
}

// DaemonAgent provides ingteration test services from within ws-daemon
type DaemonAgent struct {
}

// CreateBucket reads the daemon's config, and creates a bucket
func (*DaemonAgent) CreateBucket(args *api.CreateBucketRequest, resp *api.CreateBucketResponse) error {
	*resp = api.CreateBucketResponse{}

	fc, err := os.ReadFile("/config/config.json")
	if err != nil {
		return err
	}
	var cfg daemonConfig
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return err
	}

	ac, err := storage.NewDirectAccess(&cfg.Daemon.Content.Storage)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	err = ac.Init(ctx, args.Owner, args.Workspace, "")
	if err != nil {
		return err
	}

	err = ac.EnsureExists(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (*DaemonAgent) GetWorkspaceResources(args *api.GetWorkspaceResourcesRequest, resp *api.GetWorkspaceResourcesResponse) error {
	*resp = api.GetWorkspaceResourcesResponse{}

	filepath.WalkDir("/mnt/node-cgroups", func(path string, d fs.DirEntry, err error) error {
		if strings.Contains(path, args.ContainerId) {
			cpu := cgroups_v2.NewCpuController(path)
			quota, _, err := cpu.Max()
			if err != nil {
				return err
			}

			resp.Found = true
			resp.CpuQuota = int64(quota)
		}

		return nil
	})

	return nil
}
