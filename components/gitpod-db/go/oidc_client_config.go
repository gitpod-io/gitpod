// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OIDCClientConfig struct {
	ID uuid.UUID `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`

	OrganizationID uuid.UUID `gorm:"column:organizationId;type:char;size:36;" json:"organizationId"`

	Issuer string `gorm:"column:issuer;type:char;size:255;" json:"issuer"`

	Data EncryptedJSON[OIDCSpec] `gorm:"column:data;type:text;size:65535" json:"data"`

	Active bool `gorm:"column:active;type:tinyint;default:0;" json:"active"`

	Verified *bool `gorm:"column:verified;type:tinyint;default:0;" json:"verified"`

	LastModified time.Time `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
	// deleted is reserved for use by periodic deleter.
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

func BoolPointer(b bool) *bool {
	return &b
}

func (c *OIDCClientConfig) TableName() string {
	return "d_b_oidc_client_config"
}

// It feels wrong to have to define re-define all of these fields.
// However, I could not find a Go library which would include json annotations on the structs to guarantee the fields
// will remain consistent over time (and resilient to rename). If we find one, we can change this.
type OIDCSpec struct {
	// ClientID is the application's ID.
	ClientID string `json:"clientId"`

	// ClientSecret is the application's secret.
	ClientSecret string `json:"clientSecret"`

	// RedirectURL is the URL to redirect users going through
	// the OAuth flow, after the resource owner's URLs.
	RedirectURL string `json:"redirectUrl"`

	// Scope specifies optional requested permissions.
	Scopes []string `json:"scopes"`

	// CelExpression is an optional expression that can be used to determine if the client should be allowed to authenticate.
	CelExpression string `json:"celExpression"`

	// UsePKCE specifies if the client should use PKCE for the OAuth flow.
	UsePKCE bool `json:"usePKCE"`
}

func CreateOIDCClientConfig(ctx context.Context, conn *gorm.DB, cfg OIDCClientConfig) (OIDCClientConfig, error) {
	if cfg.ID == uuid.Nil {
		return OIDCClientConfig{}, errors.New("ID must be set")
	}

	if cfg.OrganizationID == uuid.Nil {
		return OIDCClientConfig{}, errors.New("organization ID must be set")
	}

	if cfg.Issuer == "" {
		return OIDCClientConfig{}, errors.New("issuer must be set")
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
			return OIDCClientConfig{}, fmt.Errorf("OIDC Client Config with ID %s does not exist: %w", id.String(), ErrorNotFound)
		}
		return OIDCClientConfig{}, fmt.Errorf("Failed to retrieve OIDC client config: %v", tx.Error)
	}

	return config, nil
}

func GetOIDCClientConfigForOrganization(ctx context.Context, conn *gorm.DB, id, organizationID uuid.UUID) (OIDCClientConfig, error) {
	var config OIDCClientConfig

	if id == uuid.Nil {
		return OIDCClientConfig{}, fmt.Errorf("OIDC Client Config ID is a required argument")
	}

	if organizationID == uuid.Nil {
		return OIDCClientConfig{}, fmt.Errorf("organization id is a required argument")
	}

	tx := conn.
		WithContext(ctx).
		Where("id = ?", id).
		Where("organizationId = ?", organizationID).
		Where("deleted = ?", 0).
		First(&config)
	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return OIDCClientConfig{}, fmt.Errorf("OIDC Client Config with ID %s for Organization ID %s does not exist: %w", id.String(), organizationID.String(), ErrorNotFound)
		}

		return OIDCClientConfig{}, fmt.Errorf("Failed to retrieve OIDC client config %s for Organization ID %s: %v", id.String(), organizationID.String(), tx.Error)
	}

	return config, nil
}

func ListOIDCClientConfigsForOrganization(ctx context.Context, conn *gorm.DB, organizationID uuid.UUID) ([]OIDCClientConfig, error) {
	if organizationID == uuid.Nil {
		return nil, errors.New("organization ID is a required argument")
	}

	var results []OIDCClientConfig

	tx := conn.
		WithContext(ctx).
		Where("organizationId = ?", organizationID.String()).
		Where("deleted = ?", 0).
		Order("id").
		Find(&results)
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to list oidc client configs for organization %s: %w", organizationID.String(), tx.Error)
	}

	return results, nil
}

func DeleteOIDCClientConfig(ctx context.Context, conn *gorm.DB, id, organizationID uuid.UUID) error {
	if id == uuid.Nil {
		return fmt.Errorf("id is a required argument")
	}

	if organizationID == uuid.Nil {
		return fmt.Errorf("organization id is a required argument")
	}

	tx := conn.
		WithContext(ctx).
		Table((&OIDCClientConfig{}).TableName()).
		Where("id = ?", id).
		Where("organizationId = ?", organizationID).
		Where("deleted = ?", 0).
		Update("deleted", 1)

	if tx.Error != nil {
		return fmt.Errorf("failed to delete oidc client config (ID: %s): %v", id.String(), tx.Error)
	}

	if tx.RowsAffected == 0 {
		return fmt.Errorf("oidc client config ID: %s for organization ID: %s does not exist: %w", id.String(), organizationID.String(), ErrorNotFound)
	}

	return nil
}

func GetActiveOIDCClientConfigByOrgSlug(ctx context.Context, conn *gorm.DB, slug string) (OIDCClientConfig, error) {
	var config OIDCClientConfig

	if slug == "" {
		return OIDCClientConfig{}, fmt.Errorf("slug is a required argument")
	}

	tx := conn.
		WithContext(ctx).
		Table(fmt.Sprintf("%s as config", (&OIDCClientConfig{}).TableName())).
		Joins(fmt.Sprintf("JOIN %s AS team ON team.id = config.organizationId", (&Organization{}).TableName())).
		Where("team.slug = ?", slug).
		Where("config.deleted = ?", 0).
		Where("config.active = ?", 1).
		First(&config)

	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return OIDCClientConfig{}, fmt.Errorf("OIDC Client Config for Organization (slug: %s) does not exist: %w", slug, ErrorNotFound)
		}
		return OIDCClientConfig{}, fmt.Errorf("Failed to retrieve OIDC client config: %v", tx.Error)
	}

	return config, nil
}

// UpdateOIDCClientConfig performs an update of the OIDC Client config.
// Only non-zero fields specified in the struct are updated.
// When updating the encrypted contents of the specUpdate, you can specify them in the update to have re-encrypted in a transaction.
func UpdateOIDCClientConfig(ctx context.Context, conn *gorm.DB, cipher Cipher, update OIDCClientConfig, specUpdate *OIDCSpec) error {
	if update.ID == uuid.Nil {
		return errors.New("id is a required field")
	}

	txErr := conn.
		WithContext(ctx).
		Transaction(func(tx *gorm.DB) error {
			if specUpdate != nil {
				// we also need to update the contents of the encrypted spec.
				existing, err := GetOIDCClientConfig(ctx, conn, update.ID)
				if err != nil {
					return err
				}

				decrypted, err := existing.Data.Decrypt(cipher)
				if err != nil {
					return fmt.Errorf("failed to decrypt oidc spec: %w", err)
				}

				updatedSpec := partialUpdateOIDCSpec(decrypted, *specUpdate)

				encrypted, err := EncryptJSON(cipher, updatedSpec)
				if err != nil {
					return fmt.Errorf("failed to encrypt oidc spec: %w", err)
				}

				// Set the serialized contents on our desired update object
				update.Data = encrypted

				// Each update should unverify the entry
				update.Verified = BoolPointer(false)
			}

			updateTx := tx.
				Model(&OIDCClientConfig{}).
				Where("id = ?", update.ID.String()).
				Where("deleted = ?", 0).
				Updates(update)
			if updateTx.Error != nil {
				return fmt.Errorf("failed to update OIDC client: %w", updateTx.Error)
			}

			if updateTx.RowsAffected == 0 {
				// FIXME(at) this should not return an error in case of empty update
				return fmt.Errorf("OIDC client config ID: %s does not exist: %w", update.ID.String(), ErrorNotFound)
			}

			// return nil will commit the whole transaction
			return nil
		})

	if txErr != nil {
		return fmt.Errorf("failed to update oidc spec ID: %s: %w", update.ID.String(), txErr)
	}

	return nil
}

func SetClientConfigActiviation(ctx context.Context, conn *gorm.DB, id uuid.UUID, active bool) error {
	config, err := GetOIDCClientConfig(ctx, conn, id)
	if err != nil {
		return err
	}

	value := 0
	if active {
		value = 1
	}

	tx := conn.
		WithContext(ctx).
		Table((&OIDCClientConfig{}).TableName()).
		Where("id = ?", id.String()).
		Update("active", value)
	if tx.Error != nil {
		return fmt.Errorf("failed to set oidc client config as active to %d (id: %s): %v", value, id.String(), tx.Error)
	}

	if active {
		tx := conn.
			WithContext(ctx).
			Table((&OIDCClientConfig{}).TableName()).
			Where("id != ?", id.String()).
			Where("organizationId = ?", config.OrganizationID).
			Where("deleted = ?", 0).
			Update("active", 0)
		if tx.Error != nil {
			return fmt.Errorf("failed to set other oidc client configs as inactive: %v", tx.Error)
		}
	}

	return nil
}

func VerifyClientConfig(ctx context.Context, conn *gorm.DB, id uuid.UUID) error {
	return setClientConfigVerifiedFlag(ctx, conn, id, true)
}

func UnverifyClientConfig(ctx context.Context, conn *gorm.DB, id uuid.UUID) error {
	return setClientConfigVerifiedFlag(ctx, conn, id, false)
}

func setClientConfigVerifiedFlag(ctx context.Context, conn *gorm.DB, id uuid.UUID, verified bool) error {
	_, err := GetOIDCClientConfig(ctx, conn, id)
	if err != nil {
		return err
	}

	value := 0
	if verified {
		value = 1
	}

	tx := conn.
		WithContext(ctx).
		Table((&OIDCClientConfig{}).TableName()).
		Where("id = ?", id.String()).
		Update("verified", value)
	if tx.Error != nil {
		return fmt.Errorf("failed to set oidc client config as active to %d (id: %s): %v", value, id.String(), tx.Error)
	}

	return nil
}

func partialUpdateOIDCSpec(old, new OIDCSpec) OIDCSpec {
	if new.ClientID != "" {
		old.ClientID = new.ClientID
	}

	if new.ClientSecret != "" {
		old.ClientSecret = new.ClientSecret
	}

	if new.RedirectURL != "" {
		old.RedirectURL = new.RedirectURL
	}

	old.CelExpression = new.CelExpression
	old.UsePKCE = new.UsePKCE

	if !oidcScopesEqual(old.Scopes, new.Scopes) {
		old.Scopes = new.Scopes
	}

	return old
}

func oidcScopesEqual(old, new []string) bool {
	if len(old) != len(new) {
		return false
	}

	sort.Strings(old)
	sort.Strings(new)

	for i := 0; i < len(old); i++ {
		if old[i] != new[i] {
			return false
		}
	}

	return true
}
