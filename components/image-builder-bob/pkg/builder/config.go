// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package builder

import (
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// Config configures a builder
type Config struct {
	TargetRef          string
	BaseRef            string
	BaseContext        string
	BuildBase          bool
	WorkspaceLayerAuth string
	Dockerfile         string
	ContextDir         string
	ExternalBuildkitd  string
	localCacheImport   string
}

// GetConfigFromEnv extracts configuration from environment variables
func GetConfigFromEnv() (*Config, error) {
	cfg := &Config{
		TargetRef:          os.Getenv("BOB_TARGET_REF"),
		BaseRef:            os.Getenv("BOB_BASE_REF"),
		BaseContext:        os.Getenv("THEIA_WORKSPACE_ROOT"),
		BuildBase:          os.Getenv("BOB_BUILD_BASE") == "true",
		WorkspaceLayerAuth: os.Getenv("BOB_WSLAYER_AUTH"),
		Dockerfile:         os.Getenv("BOB_DOCKERFILE_PATH"),
		ContextDir:         os.Getenv("BOB_CONTEXT_DIR"),
		ExternalBuildkitd:  os.Getenv("BOB_EXTERNAL_BUILDKITD"),
		localCacheImport:   os.Getenv("BOB_LOCAL_CACHE_IMPORT"),
	}

	if cfg.BaseRef == "" {
		cfg.BaseRef = "localhost:8080/base:latest"
	}
	if cfg.TargetRef == "" {
		cfg.TargetRef = "localhost:8080/target:latest"
	}
	if cfg.BuildBase {
		if cfg.Dockerfile == "" {
			return nil, xerrors.Errorf("When building the base image BOB_DOCKERFILE_PATH is mandatory")
		}
		var err error
		cfg.Dockerfile, err = filepath.Abs(cfg.Dockerfile)
		if err != nil {
			return nil, xerrors.Errorf("cannot make BOB_DOCKERFILE_PATH absolute: %w", err)
		}
		if !strings.HasPrefix(cfg.Dockerfile, "/workspace") {
			return nil, xerrors.Errorf("BOB_DOCKERFILE_PATH must begin with /workspace")
		}
		if stat, err := os.Stat(cfg.Dockerfile); err != nil || stat.IsDir() {
			return nil, xerrors.Errorf("BOB_DOCKERFILE_PATH does not exist or isn't a file")
		}
	}
	if cfg.WorkspaceLayerAuth == "" {
		cfg.WorkspaceLayerAuth = "[]"
	}

	return cfg, nil
}
