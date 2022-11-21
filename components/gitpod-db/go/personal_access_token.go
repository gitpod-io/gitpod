// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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
	Description    string    `gorm:"column:description;type:varchar;size:255;" json:"description"`
	Scopes         Scopes    `gorm:"column:scopes;type:text;size:65535;" json:"scopes"`
	ExpirationTime time.Time `gorm:"column:expirationTime;type:timestamp;" json:"expirationTime"`
	CreatedAt      time.Time `gorm:"column:createdAt;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"createdAt"`
	LastModified   time.Time `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	// deleted is reserved for use by db-sync.
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *PersonalAccessToken) TableName() string {
	return "d_b_personal_access_token"
}

func GetToken(ctx context.Context, conn *gorm.DB, id uuid.UUID) (PersonalAccessToken, error) {
	var token PersonalAccessToken

	db := conn.WithContext(ctx)

	db = db.Where("id = ?", id).First(&token)
	if db.Error != nil {
		return PersonalAccessToken{}, fmt.Errorf("Failed to retrieve token: %w", db.Error)
	}

	return token, nil
}

func CreateToken(ctx context.Context, conn *gorm.DB, req PersonalAccessToken) (PersonalAccessToken, error) {
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

	token := PersonalAccessToken{
		ID:             req.ID,
		UserID:         req.UserID,
		Hash:           req.Hash,
		Name:           req.Name,
		Description:    req.Description,
		Scopes:         req.Scopes,
		ExpirationTime: req.ExpirationTime,
		CreatedAt:      time.Now().UTC(),
		LastModified:   time.Now().UTC(),
	}

	tx := conn.WithContext(ctx).Create(req)
	if tx.Error != nil {
		return PersonalAccessToken{}, fmt.Errorf("Failed to create token for user %s", req.UserID)
	}

	return token, nil
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
		Count(&count)
	if tx.Error != nil {
		return nil, fmt.Errorf("failed to count total number of personal access tokens for user %s: %w", userID.String(), tx.Error)
	}

	return &PaginatedResult[PersonalAccessToken]{
		Results: results,
		Total:   count,
	}, nil
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
