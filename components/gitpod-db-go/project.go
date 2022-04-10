package db

import (
	"database/sql"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"time"
)

type Project struct {
	ID                uuid.UUID       `gorm:"primary_key;column:id;type:char;size:36;"`
	Name              string          `gorm:"column:name;type:varchar;size:255;"`
	CloneURL          string          `gorm:"column:cloneUrl;type:varchar;size:255;"`
	TeamID            sql.NullString  `gorm:"column:teamId;type:char;size:36;"`
	AppInstallationID string          `gorm:"column:appInstallationId;type:varchar;size:255;"`
	CreationTime      VarcharTime     `gorm:"column:creationTime;type:varchar;size:255;"`
	Deleted           int32           `gorm:"column:deleted;type:tinyint;default:0;"`
	LastModified      time.Time       `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);"`
	Config            *datatypes.JSON `gorm:"column:config;type:text;size:65535;"`
	UserID            sql.NullString  `gorm:"column:userId;type:char;size:36;"`
	Slug              sql.NullString  `gorm:"column:slug;type:varchar;size:255;"`
	Settings          *datatypes.JSON `gorm:"column:settings;type:text;size:65535;"`

	_ int32 `gorm:"column:markedDeleted;type:tinyint;default:0;"`
}

// TableName sets the insert table name for this struct type
func (d *Project) TableName() string {
	return "d_b_project"
}
