// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package syncd

import (
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/cri"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
	"github.com/gitpod-io/gitpod/ws-sync/pkg/quota"
	"github.com/gitpod-io/gitpod/ws-sync/pkg/safetynet"
)

// Configuration configures the workspace manager
type Configuration struct {
	// WorkingArea is the location on-disk where we create workspaces
	WorkingArea string `json:"workingArea"`

	// TmpDir is the temp working diretory for creating tar files during upload
	TmpDir string `json:"tempDir"`

	// Limit limits the size of a sandbox
	WorkspaceSizeLimit quota.Size `json:"workspaceSizeLimit"`

	// Storage is some form of permanent file store to which we back up workspaces
	Storage storage.Config `json:"storage"`

	// Backup configures the behaviour of ws-sync during backup
	Backup struct {
		// Timeout configures the maximum time the remote storage upload can take
		// per attempt. Defaults to 10 minutes.
		Timeout util.Duration `json:"timeout,omitempty"`

		// Attempts configures how many backup attempts we will make.
		// Detaults to 3
		Attempts int `json:"backupAttempts"`

		// Period is the time between regular workspace backups
		Period util.Duration `json:"period"`
	} `json:"backup,omitempty"`

	// FullWorkspaceBackup configures the FWB behaviour
	FullWorkspaceBackup FullWorkspaceBackupConfig `json:"fullWorkspaceBackup,omitempty"`

	// KubernetesNamespace is the namespace this ws-sync is deployed in
	KubernetesNamespace string `json:"namespace"`
}

// FullWorkspaceBackupConfig configures the full workspace backup behaviour
type FullWorkspaceBackupConfig struct {
	Enabled bool `json:"enabled"`

	// CRI configures ws-sync's container runtime interface
	CRI *cri.Config `json:"cri"`

	// WorkDir is a directory located on the same disk as the upperdir of containers
	WorkDir string `json:"workdir"`
}

// NewLiveBackup produces a new live backup
func (fwbc *FullWorkspaceBackupConfig) NewLiveBackup(instanceID string, src string) (*safetynet.LiveWorkspaceBackup, error) {
	if !fwbc.Enabled {
		return nil, nil
	}

	res := &safetynet.LiveWorkspaceBackup{
		OWI:         log.OWI("", "", instanceID),
		Location:    src,
		Destination: filepath.Join(fwbc.WorkDir, instanceID),
	}
	return res, nil
}
