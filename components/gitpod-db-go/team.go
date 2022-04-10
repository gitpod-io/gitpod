package db

import (
	"context"
	"github.com/google/uuid"
	"time"
)

type Team struct {
	ID           uuid.UUID   `gorm:"primary_key;column:id;type:char;size:36;"`
	Name         string      `gorm:"column:name;type:varchar;size:255;"`
	Slug         string      `gorm:"column:slug;type:varchar;size:255;"`
	CreationTime VarcharTime `gorm:"column:creationTime;type:varchar;size:255;"`
	Deleted      int32       `gorm:"column:deleted;type:tinyint;default:0;"`
	LastModified time.Time   `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);"`
	_            int32       `gorm:"column:markedDeleted;type:tinyint;default:0;"`
}

// TableName overrides default GORM handling of table name generation
func (t *Team) TableName() string {
	return "d_b_team"
}

type ListOpts struct {
	OrderBy    string
	SearchTerm string
}

type TeamRepository interface {
	List(ctx context.Context, opts ListOpts) ([]*Team, error)

	Get(ctx context.Context, id string) (*Team, error)
	GetByUser(ctx context.Context, userID string) (*Team, error)

	Create(ctx context.Context, team Team) (*Team, error)

	Delete(ctx context.Context, id string) (*Team, error)
}
