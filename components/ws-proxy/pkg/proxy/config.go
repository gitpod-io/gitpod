// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/util"
	validation "github.com/go-ozzo/ozzo-validation"
	"golang.org/x/xerrors"
)

// Config is the configuration for a WorkspaceProxy
type Config struct {
	HTTPS struct {
		Enabled     bool   `json:"enabled"`
		Key         string `json:"key"`
		Certificate string `json:"crt"`
	} `json:"https,omitempty"`

	TransportConfig    *TransportConfig    `json:"transportConfig"`
	BlobServer         *BlobServerConfig   `json:"blobServer"`
	GitpodInstallation *GitpodInstallation `json:"gitpodInstallation"`
	WorkspacePodConfig *WorkspacePodConfig `json:"workspacePodConfig"`

	BuiltinPages BuiltinPagesConfig `json:"builtinPages"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *Config) Validate() error {
	type validatable interface {
		Validate() error
	}
	for _, v := range []validatable{
		c.TransportConfig,
		c.BlobServer,
		c.GitpodInstallation,
		c.WorkspacePodConfig,
	} {
		err := v.Validate()
		if err != nil {
			return err
		}
	}

	return nil
}

// WorkspacePodConfig contains config around the workspace pod
type WorkspacePodConfig struct {
	ServiceTemplate     string `json:"serviceTemplate"`
	PortServiceTemplate string `json:"portServiceTemplate"`
	TheiaPort           uint16 `json:"theiaPort"`
	SupervisorPort      uint16 `json:"supervisorPort"`
	SupervisorImage     string `json:"supervisorImage"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *WorkspacePodConfig) Validate() error {
	if c == nil {
		return xerrors.Errorf("WorkspacePodConfig not configured")
	}

	err := validation.ValidateStruct(c,
		validation.Field(&c.ServiceTemplate, validation.Required),
		validation.Field(&c.PortServiceTemplate, validation.Required),
		validation.Field(&c.TheiaPort, validation.Required),
		validation.Field(&c.SupervisorPort, validation.Required),
		validation.Field(&c.SupervisorImage, validation.Required),
	)
	return err
}

// GitpodInstallation contains config regarding the Gitpod installation
type GitpodInstallation struct {
	Scheme              string `json:"scheme"`
	HostName            string `json:"hostName"`
	WorkspaceHostSuffix string `json:"workspaceHostSuffix"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *GitpodInstallation) Validate() error {
	if c == nil {
		return xerrors.Errorf("GitpodInstallation not configured")
	}

	return validation.ValidateStruct(c,
		validation.Field(&c.Scheme, validation.Required),
		validation.Field(&c.HostName, validation.Required), // TODO IP ONLY: Check if there is any dependency. If yes, remove it.
	)
}

// BlobServerConfig configures where to serve the IDE from
type BlobServerConfig struct {
	Scheme string `json:"scheme"`
	Host   string `json:"host"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *BlobServerConfig) Validate() error {
	if c == nil {
		return xerrors.Errorf("BlobServer not configured")
	}

	err := validation.ValidateStruct(c,
		validation.Field(&c.Scheme, validation.Required, validation.In("http", "https")),
		validation.Field(&c.Host, validation.Required),
	)
	if err != nil {
		return fmt.Errorf("invalid blobserver config: %w", err)
	}
	return nil
}

// TransportConfig configures the way how ws-proxy connects to it's backend services
type TransportConfig struct {
	ConnectTimeout           util.Duration `json:"connectTimeout"`
	IdleConnTimeout          util.Duration `json:"idleConnTimeout"`
	WebsocketIdleConnTimeout util.Duration `json:"websocketIdleConnTimeout"`
	MaxIdleConns             int           `json:"maxIdleConns"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *TransportConfig) Validate() error {
	if c == nil {
		return xerrors.Errorf("TransportConfig not configured")
	}

	return validation.ValidateStruct(c,
		validation.Field(&c.ConnectTimeout, validation.Required),
		validation.Field(&c.IdleConnTimeout, validation.Required),
		validation.Field(&c.WebsocketIdleConnTimeout, validation.Required),
		validation.Field(&c.MaxIdleConns, validation.Required, validation.Min(1)),
	)
}

// BuiltinPagesConfig configures pages served directly by ws-proxy
type BuiltinPagesConfig struct {
	Location string `json:"location"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *BuiltinPagesConfig) Validate() error {
	if c == nil {
		return xerrors.Errorf("BuiltinPagesConfig not configured")
	}

	return validation.ValidateStruct(c,
		validation.Field(&c.Location,
			validation.Required,
			validation.By(validateFileExists("")),
			validation.By(validateFileExists(builtinPagePortNotFound)),
		),
	)
}

func validateFileExists(addition string) validation.RuleFunc {
	tpRoot := os.Getenv("TELEPRESENCE_ROOT")

	return func(value interface{}) error {
		pth, ok := value.(string)
		if !ok {
			return xerrors.Errorf("validateFileExists: value must be a string")
		}

		fn := filepath.Join(pth, addition)
		if tpRoot != "" {
			fn = filepath.Join(tpRoot, fn)
		}

		_, err := os.Stat(fn)
		if err != nil {
			return err
		}

		return nil
	}
}
