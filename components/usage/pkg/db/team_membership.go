// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package db

import (
	"github.com/google/uuid"
	"time"
)

type TeamMembership struct {
	ID uuid.UUID `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`

	TeamID         uuid.UUID          `gorm:"column:teamId;type:char;size:36;" json:"teamId"`
	UserID         uuid.UUID          `gorm:"column:userId;type:char;size:36;" json:"userId"`
	Role           TeamMembershipRole `gorm:"column:role;type:varchar;size:255;" json:"role"`
	SubscriptionID uuid.UUID          `gorm:"column:subscriptionId;type:char;size:36;" json:"subscriptionId"`

	CreationTime VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	// Read-only (-> property).
	LastModified time.Time `gorm:"->:column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	// deleted column is reserved for use by db-sync
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *TeamMembership) TableName() string {
	return "d_b_team_membership"
}

type TeamMembershipRole string

const (
	TeamMembershipRole_Owner  = TeamMembershipRole("owner")
	TeamMembershipRole_Member = TeamMembershipRole("member")
)
