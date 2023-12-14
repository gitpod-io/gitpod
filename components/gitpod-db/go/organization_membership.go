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

type OrganizationMembership struct {
	ID uuid.UUID `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`

	OrganizationID uuid.UUID                  `gorm:"column:teamId;type:char;size:36;" json:"teamId"`
	UserID         uuid.UUID                  `gorm:"column:userId;type:char;size:36;" json:"userId"`
	Role           OrganizationMembershipRole `gorm:"column:role;type:varchar;size:255;" json:"role"`

	CreationTime VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	// Read-only (-> property).
	LastModified time.Time `gorm:"->:column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`
}

// TableName sets the insert table name for this struct type
func (d *OrganizationMembership) TableName() string {
	return "d_b_team_membership"
}

type OrganizationMembershipRole string

const (
	OrganizationMembershipRole_Owner  = OrganizationMembershipRole("owner")
	OrganizationMembershipRole_Member = OrganizationMembershipRole("member")
)

func GetOrganizationMembership(ctx context.Context, conn *gorm.DB, userID, orgID uuid.UUID) (OrganizationMembership, error) {
	if userID == uuid.Nil {
		return OrganizationMembership{}, errors.New("user ID must not be empty")
	}

	if orgID == uuid.Nil {
		return OrganizationMembership{}, errors.New("Organization ID must not be empty")
	}

	var membership OrganizationMembership
	tx := conn.WithContext(ctx).
		Where("userId = ?", userID.String()).
		Where("teamId = ?", orgID.String()).
		First(&membership)
	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return OrganizationMembership{}, fmt.Errorf("no membership record for user %s and organization %s exists: %w", userID.String(), orgID.String(), ErrorNotFound)
		}
		return OrganizationMembership{}, fmt.Errorf("failed to retrieve organization membership for user %s, organization %s: %w", userID.String(), orgID.String(), tx.Error)
	}

	return membership, nil
}

func DeleteOrganizationMembership(ctx context.Context, conn *gorm.DB, userID uuid.UUID, orgID uuid.UUID) error {
	if userID == uuid.Nil {
		return errors.New("user ID must not be empty")
	}

	if orgID == uuid.Nil {
		return errors.New("organization ID must not be empty")
	}

	tx := conn.WithContext(ctx).
		Model(&OrganizationMembership{}).
		Where("userId = ?", userID.String()).
		Where("teamId = ?", orgID.String()).
		Delete(&OrganizationMembership{})
	if tx.Error != nil {
		return fmt.Errorf("failed to retrieve organization membership for user %s, organization %s: %w", userID.String(), orgID.String(), tx.Error)
	}
	if tx.RowsAffected == 0 {
		return fmt.Errorf("no membership record for user %s and organization %s exists: %w", userID.String(), orgID.String(), ErrorNotFound)
	}

	return nil
}
