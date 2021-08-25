// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package theialib

//go:generate go run ../../generate-theia-protocol.go ../../../theia/packages/gitpod-extension/src/common/cli-service.ts
//go:generate sh -c "go get github.com/golang/mock/mockgen@latest"
//go:generate sh -c "mockgen -package theialib -source=protocol.go > mock.go_; mv mock.go_ mock.go; go mod tidy -compat=1.17"

// Use go generate to regenerate the Typescript protocol file

// TheiaCLIService offers services through the Theia backend/frontend
type TheiaCLIService interface {
	GetGitToken(GetGitTokenRequest) (*GetGitTokenResponse, error)
	OpenPreview(OpenPreviewRequest) (*OpenPreviewResponse, error)
	OpenFile(OpenFileRequest) (*OpenFileResponse, error)
	IsFileOpen(IsFileOpenRequest) (*IsFileOpenResponse, error)
	GetEnvVars(GetEnvvarsRequest) (*GetEnvvarsResponse, error)
	SetEnvVar(SetEnvvarRequest) (*SetEnvvarResponse, error)
	DeleteEnvVar(DeleteEnvvarRequest) (*DeleteEnvvarResponse, error)
	GetPortURL(GetPortURLRequest) (*GetPortURLResponse, error)
}

// GetGitTokenRequest requests a Git token used by the credential helper
type GetGitTokenRequest struct {
	Host    string `json:"host"`
	RepoURL string `json:"repoURL,omitempty"`
	Command string `json:"gitCommand,omitempty"`
}

// GetGitTokenResponse contains a username/token used by the credential helper
type GetGitTokenResponse struct {
	User  string `json:"user"`
	Token string `json:"token"`
}

// OpenPreviewRequest requests that a URL be opened in a preview tab
type OpenPreviewRequest struct {
	URL string `json:"url"`
}

// OpenPreviewResponse is the response for an OpenPreviewRequest
type OpenPreviewResponse struct{}

// OpenFileRequest requests that a file be opened in an editor
type OpenFileRequest struct {
	Path string `json:"path"`
}

// OpenFileResponse is the response for an OpenFileRequest
type OpenFileResponse struct{}

// IsFileOpenRequest checks if a file is open
type IsFileOpenRequest struct {
	Path string `json:"path"`
}

// IsFileOpenResponse is the response to a "is file open" request
type IsFileOpenResponse struct {
	IsOpen bool `json:"isOpen"`
}

// SetEnvvarRequest sets a user-defined environment variable to a particular value
type SetEnvvarRequest struct {
	Variables []EnvironmentVariable `json:"variables"`
}

// SetEnvvarResponse is the response to a SetEnvvarRequest
type SetEnvvarResponse struct{}

// GetEnvvarsRequest requests a list of user-defined environment variables for the current repository
type GetEnvvarsRequest struct{}

// GetEnvvarsResponse lists all environment variables which apply to the current repository
type GetEnvvarsResponse struct {
	Variables []EnvironmentVariable `json:"variables"`
}

// DeleteEnvvarRequest requests that an environment variable is deleted
type DeleteEnvvarRequest struct {
	Variables []string `json:"variables"`
}

// DeleteEnvvarResponse is the response to environment variable is deletion
type DeleteEnvvarResponse struct {
	Deleted    []string `json:"deleted"`
	NotDeleted []string `json:"notDeleted"`
}

// EnvironmentVariable is an env var
type EnvironmentVariable struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// GetPortURLRequest requests the public, outward-facing URL for a port
type GetPortURLRequest struct {
	Port uint16 `json:"port"`
}

// GetPortURLResponse is the response when asking for a port's public URL
type GetPortURLResponse struct {
	URL string `json:"url"`
}
