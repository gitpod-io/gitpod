// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"encoding/json"
	"os"

	"github.com/gitpod-io/gitpod/blobserve/pkg/blobserve"
)

// Config configures this service
type Config struct {
	BlobServe          blobserve.Config `json:"blobserve"`
	AuthCfg            string           `json:"dockerAuth"`
	PProfAddr          string           `json:"pprofAddr"`
	PrometheusAddr     string           `json:"prometheusAddr"`
	ReadinessProbeAddr string           `json:"readinessProbeAddr"`
}

// getConfig loads and validates the configuration
func GetConfig(fn string) (*Config, error) {
	fc, err := os.ReadFile(fn)
	if err != nil {
		return nil, err
	}

	var cfg Config
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return nil, err
	}

	return &cfg, nil
}
