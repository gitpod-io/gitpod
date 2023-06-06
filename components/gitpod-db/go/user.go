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
)

type User struct {
	ID uuid.UUID `gorm:"primary_key;column:id;type:char;size:36;"`

	// If the User is exclusively owned by an Organization, the owning Organization will be set.
	OrganizationID     *uuid.UUID    `gorm:"column:organizationId;type:char;size:255;"`
	UsageAttributionID AttributionID `gorm:"column:usageAttributionId;type:char;size:60;default:'';not null;"`

	Name      string `gorm:"column:name;type:char;size:255;"`
	FullName  string `gorm:"column:fullName;type:char;size:255;"`
	AvatarURL string `gorm:"column:avatarUrl;type:char;size:255;"`

	Blocked    bool `gorm:"column:blocked;type:tinyint;default:0;not null;" json:"blocked"`
	Privileged bool `gorm:"column:privileged;type:tinyint;default:0;not null;" json:"privileged"`

	RolesOrPermissions *string `gorm:"column:rolesOrPermissions;type:text;"`
	FeatureFlags       *string `gorm:"column:featureFlags;type:text;"`

	VerificationPhoneNumber string      `gorm:"column:verificationPhoneNumber;type:char;size:30;default:'';not null;"`
	LastVerificationTime    VarcharTime `gorm:"column:lastVerificationTime;type:char;size:30;default:'';not null;"`

	AdditionalData *string `gorm:"column:additionalData;type:text;"`

	// Identities can be loaded with Preload("Identities") from the `d_b_identity` table as
	// a One to Many relationship
	Identities []Identity `gorm:"foreignKey:userId;references:id"`

	CreationDate VarcharTime `gorm:"column:creationDate;type:varchar;size:255;"`

	MarkedDeleted bool `gorm:"column:markedDeleted;type:tinyint;default:0;" json:"markedDeleted"`

	// More undefined fields
}

func (user *User) TableName() string {
	return "d_b_user"
}

func GetUser(ctx context.Context, conn *gorm.DB, id uuid.UUID) (User, error) {
	if id == uuid.Nil {
		return User{}, errors.New("id must be nil")
	}

	var user User
	tx := conn.
		Model(&User{}).
		Preload("Identities").
		First(&user, id)

	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return User{}, fmt.Errorf("user with ID %s does not exist: %w", id, ErrorNotFound)
		}

		return User{}, fmt.Errorf("Failed to retrieve user: %v", tx.Error)
	}

	return user, nil
}
