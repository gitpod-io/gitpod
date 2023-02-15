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

type Team struct {
	ID   uuid.UUID `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	Name string    `gorm:"column:name;type:varchar;size:255;" json:"name"`
	Slug string    `gorm:"column:slug;type:varchar;size:255;" json:"slug"`

	CreationTime VarcharTime `gorm:"column:creationTime;type:varchar;size:255;" json:"creationTime"`
	LastModified time.Time   `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);" json:"_lastModified"`

	MarkedDeleted bool `gorm:"column:markedDeleted;type:tinyint;default:0;" json:"marked_deleted"`

	// deleted is reserved for use by db-sync.
	_ bool `gorm:"column:deleted;type:tinyint;default:0;" json:"deleted"`
}

// TableName sets the insert table name for this struct type
func (d *Team) TableName() string {
	return "d_b_team"
}

func CreateTeam(ctx context.Context, conn *gorm.DB, newTeam Team) (Team, error) {
	if newTeam.ID == uuid.Nil {
		return Team{}, errors.New("id must be set")
	}

	if newTeam.Name == "" {
		return Team{}, errors.New("name must be set")
	}
	if newTeam.Slug == "" {
		return Team{}, errors.New("slug must be set")
	}

	tx := conn.
		WithContext(ctx).
		Create(&newTeam)
	if tx.Error != nil {
		return Team{}, fmt.Errorf("failed to create team: %w", tx.Error)
	}

	return newTeam, nil
}

func GetTeamBySlug(ctx context.Context, conn *gorm.DB, slug string) (Team, error) {
	if slug == "" {
		return Team{}, fmt.Errorf("Slug is required")
	}

	var team Team

	tx := conn.WithContext(ctx).
		Where("slug = ?", slug).
		Find(&team)

	if tx.Error != nil {
		if errors.Is(tx.Error, gorm.ErrRecordNotFound) {
			return Team{}, fmt.Errorf("Team with slug %s does not exist: %w", slug, ErrorNotFound)
		}
		return Team{}, fmt.Errorf("Failed to retrieve team: %v", tx.Error)
	}

	return team, nil
}
