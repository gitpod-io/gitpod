// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

const IDPDefaultExpiredTime = time.Hour

type IDPPublicKey struct {
	KeyID string `gorm:"primary_key;column:kid;type:char;size:36;" json:"kid"`

	Data string `gorm:"column:data;type:text;size:65535" json:"data"`

	LastActiveTime time.Time `gorm:"column:last_active_time;type:timestamp;" json:"last_active_time"`

	LastModified time.Time `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	// deleted is reserved for use by periodic deleter.
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

func (c *IDPPublicKey) TableName() string {
	return "d_b_idp_public_keys"
}

func CreateIDPPublicKey(ctx context.Context, conn *gorm.DB, key IDPPublicKey) (IDPPublicKey, error) {
	if key.KeyID == "" {
		return IDPPublicKey{}, errors.New("KeyID must be set")
	}

	if key.Data == "" {
		return IDPPublicKey{}, errors.New("Data must be set")
	}

	if key.LastActiveTime.IsZero() {
		return IDPPublicKey{}, errors.New("LastActiveTime must be set")
	}

	tx := conn.
		WithContext(ctx).
		Create(&key)
	if tx.Error != nil {
		return IDPPublicKey{}, fmt.Errorf("failed to create idp public key: %w", tx.Error)
	}

	return key, nil
}

func GetIDPPublicKey(ctx context.Context, conn *gorm.DB, keyId string) (IDPPublicKey, error) {
	var key IDPPublicKey

	if keyId == "" {
		return IDPPublicKey{}, fmt.Errorf("IDP public key ID is a required argument")
	}

	tx := conn.
		WithContext(ctx).
		Where("kid = ?", keyId).
		Where("deleted = ?", 0).
		First(&key)
	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return IDPPublicKey{}, fmt.Errorf("IDP public key with keyID %s does not exist: %w", keyId, ErrorNotFound)
		}
		return IDPPublicKey{}, fmt.Errorf("Failed to retrieve idp public key: %v", tx.Error)
	}

	return key, nil
}

func ListActiveIDPPublicKeys(ctx context.Context, conn *gorm.DB) ([]IDPPublicKey, error) {
	var results []IDPPublicKey

	tx := conn.
		WithContext(ctx).
		Where("deleted = ?", 0).
		Where("last_active_time > ?", time.Now().Add(-1*IDPDefaultExpiredTime)).
		Order("last_active_time").
		Find(&results)
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to list idp public keys: %w", tx.Error)
	}

	return results, nil
}

func DeleteExpiredIDPPublicKeys(ctx context.Context, conn *gorm.DB) error {
	tx := conn.
		WithContext(ctx).
		Table((&IDPPublicKey{}).TableName()).
		Where("last_active_time < ?", time.Now().Add(-1*IDPDefaultExpiredTime)).
		Where("deleted = ?", 0).
		Update("deleted", 1)

	if tx.Error != nil {
		return fmt.Errorf("failed to delete expired idp public keys: %w", tx.Error)
	}
	return nil
}

func MarkIDPPublicKeyActive(ctx context.Context, conn *gorm.DB, keyID string) error {
	if keyID == "" {
		return errors.New("KeyID is a required field")
	}

	_, err := GetIDPPublicKey(ctx, conn, keyID)
	if err != nil {
		return err
	}

	tx := conn.
		WithContext(ctx).
		Table((&IDPPublicKey{}).TableName()).
		Where("kid = ?", keyID).
		Where("deleted = ?", 0).
		Update("last_active_time", time.Now())

	if tx.Error != nil {
		return fmt.Errorf("failed to update idp public key last active time: %s: %w", keyID, tx.Error)
	}

	if tx.RowsAffected == 0 {
		return fmt.Errorf("IDP public key with keyID %s does not exist", keyID)
	}

	return nil
}
