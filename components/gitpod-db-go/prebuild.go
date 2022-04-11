package db

import (
	"database/sql"
	"github.com/google/uuid"
	"time"
)

type Prebuild struct {
	ID               uuid.UUID      `gorm:"primary_key;column:id;type:char;size:36;" json:"id"`
	CloneURL         string         `gorm:"column:cloneURL;type:varchar;size:255;" json:"clone_url"`
	Commit           string         `gorm:"column:commit;type:varchar;size:255;" json:"commit"`
	State            string         `gorm:"column:state;type:varchar;size:255;" json:"state"`
	BuildWorkspaceID string         `gorm:"column:buildWorkspaceId;type:char;size:36;" json:"build_workspace_id"`
	Snapshot         string         `gorm:"column:snapshot;type:varchar;size:255;" json:"snapshot"`
	Error            string         `gorm:"column:error;type:varchar;size:255;" json:"error"`
	ProjectID        sql.NullString `gorm:"column:projectId;type:char;size:36;" json:"project_id"`
	Branch           sql.NullString `gorm:"column:branch;type:varchar;size:255;" json:"branch"`
	StatusVersion    int64          `gorm:"column:statusVersion;type:bigint;default:0;" json:"status_version"`

	CreationTime time.Time `gorm:"column:creationTime;type:timestamp;default:CURRENT_TIMESTAMP(6);->;" json:"creation_time"`
	LastModified time.Time `gorm:"column:_lastModified;type:timestamp;default:CURRENT_TIMESTAMP(6);->;" json:"_last_modified"`
}

// TableName sets the insert table name for this struct type
func (d *Prebuild) TableName() string {
	return "d_b_prebuilt_workspace"
}
