package db

import (
	"context"
	"github.com/google/uuid"
)

type Team struct {
	ID            uuid.UUID `gorm:"primaryKey"`
	Name          string
	Slug          string
	CreationTime  StringlyTime `gorm:"column:creationTime"`
	MarkedDeleted bool         `gorm:"column:markedDeleted"`
}

// TableName overrides default GORM handling of table name generation
func (t *Team) TableName() string {
	return "d_b_team"
}

type ListOpts struct {
	Pagination

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
