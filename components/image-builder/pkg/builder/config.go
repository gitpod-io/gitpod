// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"golang.org/x/xerrors"
)

// Configuration configures a builder instance
type Configuration struct {
	// BaseImageRepository configures repository where we'll push base images to.
	BaseImageRepository string `json:"baseImageRepository"`

	// WorkspaceImageRepository configures the repository where we'll push the final workspace images to.
	// Note that the workspace nodes/kubelets need access to this repository.
	WorkspaceImageRepository string `json:"workspaceImageRepository"`

	// GitpodLayerLoc is the path to the Gitpod layer tar file
	GitpodLayerLoc string `json:"gitpodLayerLoc"`

	// ImageBuilderImageRef is the name of the image-builder image use for context initialization.
	// If empty, the image-builder will attempt to build one itself.
	ImageBuilderImageRef string `json:"imagebuilderRef,omitempty"`

	// Workdir is a path on the filesystem that we can place files and work to our hearts contempt.
	// This folder is used to materialize the context of builds and must be mountable from the Docker daemon.
	Workdir string `json:"workdir"`

	// DockerCfgFile is a path on the filesystem to a valid Docker CLI client config.
	// Only used for extracting authentication information.
	DockerCfgFile string `json:"dockerCfgFile,omitempty"`

	// ImageBuildSalt is used to invalidate previously built images. We include this string in the image name
	// generation, such that a change to this string results in a new image name and hence a rebuild.
	// Changing this string affects base and workspace images alike.
	ImageBuildSalt string `json:"imageBuildSalt,omitempty"`

	// AlpineImage is the image that should be pulled for the selfbuild. It is a string that is used in a
	// Dockerfile after FROM.
	AlpineImage string `json:"alpineImage,omitempty"`

	// SelfBuildBaseImage points to an image that is used as base image.
	// Needs to be an alpine image that has `git bash openssh-client lz4 coreutils` installed.
	SelfBuildBaseImage string `json:"selfBuildBaseImage,omitempty"`
}

// Validate validates the configuration
func (c *Configuration) Validate() error {
	if c.BaseImageRepository == "" {
		return xerrors.Errorf("BaseImageRepository is mandatory")
	}
	if len(c.BaseImageRepository) > 255 {
		return xerrors.Errorf("BaseImageRepository must not be longer than 255 characters")
	}
	if c.WorkspaceImageRepository == "" {
		return xerrors.Errorf("WorkspaceImageRepository is mandatory")
	}
	if len(c.WorkspaceImageRepository) > 255 {
		return xerrors.Errorf("WorkspaceImageRepository must not be longer than 255 characters")
	}

	return nil
}
