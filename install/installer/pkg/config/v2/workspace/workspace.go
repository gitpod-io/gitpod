// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v2/common"
)

type Workspace struct {
	Runtime   WorkspaceRuntime    `json:"runtime" validate:"required"`
	Resources common.Resources    `json:"resources" validate:"required"`
	Templates *WorkspaceTemplates `json:"templates,omitempty"`

	// PrebuildPVC is the struct that describes how to setup persistent volume claim for prebuild workspace
	PrebuildPVC PersistentVolumeClaim `json:"prebuildPVC" validate:"required"`

	// PVC is the struct that describes how to setup persistent volume claim for regular workspace
	PVC PersistentVolumeClaim `json:"pvc" validate:"required"`

	// MaxLifetime is the maximum time a workspace is allowed to run. After that, the workspace times out despite activity
	MaxLifetime util.Duration `json:"maxLifetime" validate:"required"`

	// TimeoutDefault is the default timeout of a regular workspace
	TimeoutDefault *util.Duration `json:"timeoutDefault,omitempty"`

	// TimeoutExtended is the workspace timeout that a user can extend to for one workspace
	TimeoutExtended *util.Duration `json:"timeoutExtended,omitempty"`

	// TimeoutAfterClose is the time a workspace timed out after it has been closed (“closed” means that it does not get a heartbeat from an IDE anymore)
	TimeoutAfterClose *util.Duration `json:"timeoutAfterClose,omitempty"`

	WorkspaceImage string `json:"workspaceImage,omitempty"`
}

type WorkspaceRuntime struct {
	// File system
	FSShiftMethod FSShiftMethod `json:"fsShiftMethod" validate:"required,fs_shift_method"`
	// The location of containerd socket on the host machine
	ContainerDRuntimeDir string `json:"containerdRuntimeDir" validate:"required,startswith=/"`
	// The location of containerd socket on the host machine
	ContainerDSocket string `json:"containerdSocket" validate:"required,startswith=/"`
}
