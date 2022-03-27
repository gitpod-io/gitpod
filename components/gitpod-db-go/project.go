package db

type Project struct {
	ID       string
	Name     string
	Slug     string
	CloneURL string

	TeamID            string
	UserID            string
	AppInstallationID string

	Config        *ProjectConfig
	Settings      *ProjectSettings
	CreationTime  string
	Deleted       bool
	MarkedDeleted bool
}

type ProjectConfig struct {
}

type ProjectSettings struct {
}
