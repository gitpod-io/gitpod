// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"github.com/moby/buildkit/client"
	"golang.org/x/xerrors"
)

// Config configures a builder
type Config struct {
	TargetRef          string
	BaseRef            string
	BaseContext        string
	BuildBase          bool
	BaseLayerAuth      string
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
		BaseLayerAuth:      os.Getenv("BOB_BASELAYER_AUTH"),
		WorkspaceLayerAuth: os.Getenv("BOB_WSLAYER_AUTH"),
		Dockerfile:         os.Getenv("BOB_DOCKERFILE_PATH"),
		ContextDir:         os.Getenv("BOB_CONTEXT_DIR"),
		ExternalBuildkitd:  os.Getenv("BOB_EXTERNAL_BUILDKITD"),
		localCacheImport:   os.Getenv("BOB_LOCAL_CACHE_IMPORT"),
	}

	if cfg.BaseRef == "" {
		return nil, xerrors.Errorf("BOB_BASE_REF must not be empty")
	}
	if cfg.TargetRef == "" {
		return nil, xerrors.Errorf("BOB_TARGET_REF must not be empty")
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

	var authKey = os.Getenv("BOB_AUTH_KEY")
	if authKey != "" {
		if len(authKey) != 32 {
			return nil, xerrors.Errorf("BOB_AUTH_KEY must be exactly 32 bytes long")
		}

		// we have an authkey, hence assume that the auth fields are base64 encoded and encrypted
		if cfg.BaseLayerAuth != "" {
			dec := make([]byte, base64.RawStdEncoding.DecodedLen(len(cfg.BaseLayerAuth)))
			_, err := base64.RawStdEncoding.Decode(dec, []byte(cfg.BaseLayerAuth))
			if err != nil {
				return nil, xerrors.Errorf("BOB_BASELAYER_AUTH is not base64 encoded but BOB_AUTH_KEY is present")
			}
			cfg.BaseLayerAuth, err = decrypt(dec, authKey)
			if err != nil {
				return nil, xerrors.Errorf("cannot decrypt BOB_BASELAYER_AUTH: %w", err)
			}
		}
		if cfg.WorkspaceLayerAuth != "" {
			dec := make([]byte, base64.RawStdEncoding.DecodedLen(len(cfg.WorkspaceLayerAuth)))
			_, err := base64.RawStdEncoding.Decode(dec, []byte(cfg.WorkspaceLayerAuth))
			if err != nil {
				return nil, xerrors.Errorf("BOB_WSLAYER_AUTH is not base64 encoded but BOB_AUTH_KEY is present")
			}
			cfg.WorkspaceLayerAuth, err = decrypt(dec, authKey)
			if err != nil {
				return nil, xerrors.Errorf("cannot decrypt BOB_WSLAYER_AUTH: %w", err)
			}
		}
	}

	return cfg, nil
}

// LocalCacheImport produces a cache option that imports from a local cache
func (c Config) LocalCacheImport() []client.CacheOptionsEntry {
	if c.localCacheImport == "" {
		return nil
	}

	return []client.CacheOptionsEntry{
		{
			Type: "local",
			Attrs: map[string]string{
				"src": c.localCacheImport,
			},
		},
	}
}

// source: https://astaxie.gitbooks.io/build-web-application-with-golang/en/09.6.html
func decrypt(ciphertext []byte, key string) (string, error) {
	c, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(c)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", xerrors.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	res, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(res), nil
}
