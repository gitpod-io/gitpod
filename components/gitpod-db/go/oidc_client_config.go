// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"context"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

type OIDCClientConfig struct {
	ID uuid.UUID `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`

	Issuer string `gorm:"column:issuer;type:char;size:255;" json:"issuer"`

	Data EncryptedJSON[OIDCSpec] `gorm:"column:data;type:text;size:65535" json:"data"`

	LastModified time.Time `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
	// deleted is reserved for use by db-sync.
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

func (c *OIDCClientConfig) TableName() string {
	return "d_b_oidc_client_config"
}

type OIDCSpec struct {
}

func CreateOIDCCLientConfig(ctx context.Context, conn *gorm.DB, cfg OIDCClientConfig) (OIDCClientConfig, error) {
	if cfg.ID == uuid.Nil {
		return OIDCClientConfig{}, errors.New("OIDC Client Config ID must be set")
	}

	if cfg.Issuer == "" {
		return OIDCClientConfig{}, errors.New("OIDC Client Config issuer must be set")
	}

	tx := conn.
		WithContext(ctx).
		Create(&cfg)
	if tx.Error != nil {
		return OIDCClientConfig{}, fmt.Errorf("failed to create oidc client config: %w", tx.Error)
	}

	return cfg, nil
}

func GetOIDCClientConfig(ctx context.Context, conn *gorm.DB, id uuid.UUID) (OIDCClientConfig, error) {
	var config OIDCClientConfig

	if id == uuid.Nil {
		return OIDCClientConfig{}, fmt.Errorf("OIDC Client Config ID is a required argument")
	}

	tx := conn.
		WithContext(ctx).
		Where("id = ?", id).
		Where("deleted = ?", 0).
		First(&config)
	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return OIDCClientConfig{}, fmt.Errorf("OIDC Client Config with ID %s does not exist: %w", id, ErrorNotFound)
		}
		return OIDCClientConfig{}, fmt.Errorf("Failed to retrieve OIDC client config: %v", tx.Error)
	}

	return config, nil
}
