// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package content

import (
	"encoding/json"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/util"
	cntntcfg "github.com/gitpod-io/gitpod/content-service/api/config"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"golang.org/x/xerrors"
)

// Config configures the workspace content service
type Config struct {
	// WorkingArea is the location on-disk where we create workspaces
	WorkingArea string `json:"workingArea"`

	// WorkingAreaNode is the location on-disk where we create workspaces,
	// as seen from the root/node mount namespace. This is the same path as WorkingArea,
	// except not from within the container, but on the node (the "other side" of the hostPath volume
	// of the ws-daemon pod).
	WorkingAreaNode string `json:"workingAreaNode"`

	// TmpDir is the temp working diretory for creating tar files during upload
	TmpDir string `json:"tempDir"`

	// Storage is some form of permanent file store to which we back up workspaces
	Storage cntntcfg.StorageConfig `json:"storage"`

	// Backup configures the behaviour of ws-daemon during backup
	Backup BackupConfig `json:"backup,omitempty"`

	// UserNamespaces configures the behaviour of the user-namespace support
	UserNamespaces UserNamespacesConfig `json:"userNamespaces,omitempty"`

	// Initializer configures the isolated content initializer runtime
	Initializer InitializerConfig `json:"initializer"`
}

type BackupConfig struct {
	// Timeout configures the maximum time the remote storage upload can take
	// per attempt. Defaults to 10 minutes.
	Timeout util.Duration `json:"timeout,omitempty"`

	// Attempts configures how many backup attempts we will make.
	// Detaults to 3
	Attempts int `json:"attempts"`

	// Period is the time between regular workspace backups
	Period util.Duration `json:"period"`
}

type UserNamespacesConfig struct {
	FSShift FSShiftMethod `json:"fsShift"`
}

type FSShiftMethod api.FSShiftMethod

// MarshalJSON marshals the api.FSShiftMethod to the api.FSShiftMethod_value
func (m FSShiftMethod) MarshalJSON() ([]byte, error) {
	methodInt := int32(m)
	v, ok := api.FSShiftMethod_name[methodInt]
	if !ok {
		return nil, xerrors.Errorf("invalid shift method: %i", methodInt)
	}
	return json.Marshal(v)
}

// UnmarshalJSON unmarshals the lowercase shift method string as defined in
// api.FSShiftMethod_value to api.FSShiftMethod
func (m *FSShiftMethod) UnmarshalJSON(data []byte) error {
	input := strings.ToUpper(strings.Trim(string(data), "\""))
	v, ok := api.FSShiftMethod_value[input]
	if !ok {
		return xerrors.Errorf("invalid shift method: %v", input)
	}
	*m = FSShiftMethod(v)
	return nil
}

type InitializerConfig struct {
	// Command is the path to content-initializer executable
	Command string `json:"command"`

	// Args are additional arguments to pass to the CI runtime
	Args []string `json:"args"`
}
