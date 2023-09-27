// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Organization struct {
	ID   uuid.UUID `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	Name string    `gorm:"column:name;type:varchar;size:255;" json:"name"`
	Slug string    `gorm:"column:slug;type:varchar;size:255;" json:"slug"`

	CreationTime VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	LastModified time.Time   `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	MarkedDeleted bool `gorm:"column:markedDeleted;type:tinyint;default:0;" json:"marked_deleted"`
}

// TableName sets the insert table name for this struct type
func (d *Organization) TableName() string {
	return "d_b_team"
}

func CreateOrganization(ctx context.Context, conn *gorm.DB, org Organization) (Organization, error) {
	if org.ID == uuid.Nil {
		return Organization{}, errors.New("id must be set")
	}

	if org.Name == "" {
		return Organization{}, errors.New("name must be set")
	}
	if org.Slug == "" {
		return Organization{}, errors.New("slug must be set")
	}

	tx := conn.
		WithContext(ctx).
		Create(&org)
	if tx.Error != nil {
		return Organization{}, fmt.Errorf("failed to create organization: %w", tx.Error)
	}

	return org, nil
}

func GetOrganizationBySlug(ctx context.Context, conn *gorm.DB, slug string) (Organization, error) {
	if slug == "" {
		return Organization{}, fmt.Errorf("Slug is required")
	}

	var org Organization

	tx := conn.WithContext(ctx).
		Where("slug = ?", slug).
		Find(&org)

	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return Organization{}, fmt.Errorf("Organization with slug %s does not exist: %w", slug, ErrorNotFound)
		}
		return Organization{}, fmt.Errorf("Failed to retrieve organization: %v", tx.Error)
	}

	return org, nil
}

// GetSingleOrganizationWithActiveSSO returns the single team with SSO enabled.
// If there is more than one team with SSO enabled, an error is returned.
func GetSingleOrganizationWithActiveSSO(ctx context.Context, conn *gorm.DB) (Organization, error) {
	var orgs []Organization

	tx := conn.
		WithContext(ctx).
		Table(fmt.Sprintf("%s as team", (&Organization{}).TableName())).
		Joins(fmt.Sprintf("JOIN %s AS config ON team.id = config.organizationId", (&OIDCClientConfig{}).TableName())).
		Where("config.deleted = ?", 0).
		Where("config.active = ?", 1).
		Find(&orgs)

	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return Organization{}, fmt.Errorf("No single organization found: %w", ErrorNotFound)
		}
		return Organization{}, fmt.Errorf("Failed to retrieve organization: %v", tx.Error)
	}

	if len(orgs) == 0 {
		return Organization{}, fmt.Errorf("No single organization with active SSO found: %w", ErrorNotFound)
	}

	if len(orgs) > 1 {
		return Organization{}, fmt.Errorf("More than one organization with active SSO found: %w", ErrorNotFound)
	}

	return orgs[0], nil
}
