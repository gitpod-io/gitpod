// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PersonalAccessToken struct {
	ID             uuid.UUID `gorm:"primary_key;column:id;type:varchar;size:255;" json:"id"`
	UserID         uuid.UUID `gorm:"column:userId;type:varchar;size:255;" json:"userId"`
	Hash           string    `gorm:"column:hash;type:varchar;size:255;" json:"hash"`
	Name           string    `gorm:"column:name;type:varchar;size:255;" json:"name"`
	Scopes         Scopes    `gorm:"column:scopes;type:text;size:65535;" json:"scopes"`
	ExpirationTime time.Time `gorm:"column:expirationTime;type:timestamp;" json:"expirationTime"`
	CreatedAt      time.Time `gorm:"column:createdAt;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"createdAt"`
	LastModified   time.Time `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	// deleted is reserved for use by periodic deleter.
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *PersonalAccessToken) TableName() string {
	return "d_b_personal_access_token"
}

func GetPersonalAccessTokenForUser(ctx context.Context, conn *gorm.DB, tokenID uuid.UUID, userID uuid.UUID) (PersonalAccessToken, error) {
	var token PersonalAccessToken

	if tokenID == uuid.Nil {
		return PersonalAccessToken{}, fmt.Errorf("Token ID is a required argument to get personal access token for user")
	}

	if userID == uuid.Nil {
		return PersonalAccessToken{}, fmt.Errorf("User ID is a required argument to get personal access token for user")
	}

	tx := conn.
		WithContext(ctx).
		Where("id = ?", tokenID).
		Where("userId = ?", userID).
		Where("deleted = ?", 0).
		First(&token)
	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return PersonalAccessToken{}, fmt.Errorf("Token with ID %s does not exist: %w", tokenID, ErrorNotFound)
		}
		return PersonalAccessToken{}, fmt.Errorf("Failed to retrieve token: %v", tx.Error)
	}

	return token, nil
}

func CreatePersonalAccessToken(ctx context.Context, conn *gorm.DB, req PersonalAccessToken) (PersonalAccessToken, error) {
	if req.UserID == uuid.Nil {
		return PersonalAccessToken{}, fmt.Errorf("Invalid or empty userID")
	}
	if req.Hash == "" {
		return PersonalAccessToken{}, fmt.Errorf("Token hash required")
	}
	if req.Name == "" {
		return PersonalAccessToken{}, fmt.Errorf("Token name required")
	}
	if req.ExpirationTime.IsZero() {
		return PersonalAccessToken{}, fmt.Errorf("Expiration time required")
	}

	now := time.Now().UTC()
	token := PersonalAccessToken{
		ID:             req.ID,
		UserID:         req.UserID,
		Hash:           req.Hash,
		Name:           req.Name,
		Scopes:         req.Scopes,
		ExpirationTime: req.ExpirationTime,
		CreatedAt:      now,
		LastModified:   now,
	}

	tx := conn.WithContext(ctx).Create(req)
	if tx.Error != nil {
		return PersonalAccessToken{}, fmt.Errorf("Failed to create personal access token for user %s", req.UserID)
	}

	return token, nil
}

func UpdatePersonalAccessTokenHash(ctx context.Context, conn *gorm.DB, tokenID uuid.UUID, userID uuid.UUID, hash string, expirationTime time.Time) (PersonalAccessToken, error) {
	if tokenID == uuid.Nil {
		return PersonalAccessToken{}, fmt.Errorf("Invalid or empty tokenID")
	}
	if userID == uuid.Nil {
		return PersonalAccessToken{}, fmt.Errorf("Invalid or empty userID")
	}
	if hash == "" {
		return PersonalAccessToken{}, fmt.Errorf("Token hash required")
	}
	if expirationTime.IsZero() {
		return PersonalAccessToken{}, fmt.Errorf("Expiration time required")
	}

	db := conn.WithContext(ctx)

	err := db.
		Where("id = ?", tokenID).
		Where("userId = ?", userID).
		Where("deleted = ?", 0).
		Select("hash", "expirationTime").Updates(PersonalAccessToken{Hash: hash, ExpirationTime: expirationTime}).
		Error
	if err != nil {
		if errors.Is(db.Error, gorm.ErrRecordNotFound) {
			return PersonalAccessToken{}, fmt.Errorf("Token with ID %s does not exist: %w", tokenID, ErrorNotFound)
		}
		return PersonalAccessToken{}, fmt.Errorf("Failed to update token: %v", db.Error)
	}

	return GetPersonalAccessTokenForUser(ctx, conn, tokenID, userID)
}

func DeletePersonalAccessTokenForUser(ctx context.Context, conn *gorm.DB, tokenID uuid.UUID, userID uuid.UUID) (int64, error) {
	if tokenID == uuid.Nil {
		return 0, fmt.Errorf("Invalid or empty tokenID")
	}

	if userID == uuid.Nil {
		return 0, fmt.Errorf("Invalid or empty userID")
	}

	db := conn.WithContext(ctx)

	db = db.
		Table((&PersonalAccessToken{}).TableName()).
		Where("id = ?", tokenID).
		Where("userId = ?", userID).
		Where("deleted = ?", 0).
		Update("deleted", 1)
	if db.Error != nil {
		return 0, fmt.Errorf("failed to delete token (ID: %s): %v", tokenID.String(), db.Error)
	}

	if db.RowsAffected == 0 {
		return 0, fmt.Errorf("token (ID: %s) for user (ID: %s) does not exist: %w", tokenID, userID, ErrorNotFound)
	}

	return db.RowsAffected, nil
}

func ListPersonalAccessTokensForUser(ctx context.Context, conn *gorm.DB, userID uuid.UUID, pagination Pagination) (*PaginatedResult[PersonalAccessToken], error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("user ID is a required argument to list personal access tokens for user, got nil")
	}

	var results []PersonalAccessToken

	tx := conn.
		WithContext(ctx).
		Table((&PersonalAccessToken{}).TableName()).
		Where("userId = ?", userID).
		Where("deleted = ?", 0).
		Order("createdAt").
		Scopes(Paginate(pagination)).
		Find(&results)
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to list personal access tokens for user %s: %w", userID.String(), tx.Error)
	}

	var count int64
	tx = conn.
		WithContext(ctx).
		Table((&PersonalAccessToken{}).TableName()).
		Where("userId = ?", userID).
		Where("deleted = ?", 0).
		Count(&count)
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to count total number of personal access tokens for user %s: %w", userID.String(), tx.Error)
	}

	return &PaginatedResult[PersonalAccessToken]{
		Results: results,
		Total:   count,
	}, nil
}

type UpdatePersonalAccessTokenOpts struct {
	TokenID uuid.UUID
	UserID  uuid.UUID
	Name    *string
	Scopes  *Scopes
}

func UpdatePersonalAccessTokenForUser(ctx context.Context, conn *gorm.DB, opts UpdatePersonalAccessTokenOpts) (PersonalAccessToken, error) {
	if opts.TokenID == uuid.Nil {
		return PersonalAccessToken{}, errors.New("Token ID is required to udpate personal access token for user")
	}
	if opts.UserID == uuid.Nil {
		return PersonalAccessToken{}, errors.New("User ID is required to udpate personal access token for user")
	}

	var cols []string
	update := PersonalAccessToken{}
	if opts.Name != nil {
		cols = append(cols, "name")
		update.Name = *opts.Name
	}

	if opts.Scopes != nil {
		cols = append(cols, "scopes")
		update.Scopes = *opts.Scopes
	}

	if len(cols) == 0 {
		return GetPersonalAccessTokenForUser(ctx, conn, opts.TokenID, opts.UserID)
	}

	tx := conn.
		WithContext(ctx).
		Table((&PersonalAccessToken{}).TableName()).
		Where("id = ?", opts.TokenID).
		Where("userId = ?", opts.UserID).
		Where("deleted = ?", 0).
		Select(cols).
		Updates(update)
	if tx.Error != nil {
		return PersonalAccessToken{}, fmt.Errorf("failed to update personal access token: %w", tx.Error)
	}

	return GetPersonalAccessTokenForUser(ctx, conn, opts.TokenID, opts.UserID)
}

type Scopes []string

// Scan() and Value() allow having a list of strings as a type for Scopes
func (s *Scopes) Scan(src any) error {
	bytes, ok := src.([]byte)
	if !ok {
		return errors.New("src value cannot cast to []byte")
	}

	if len(bytes) == 0 {
		*s = nil
		return nil
	}

	*s = strings.Split(string(bytes), ",")
	return nil
}

func (s Scopes) Value() (driver.Value, error) {
	if len(s) == 0 {
		return "", nil
	}
	return strings.Join(s, ","), nil
}
