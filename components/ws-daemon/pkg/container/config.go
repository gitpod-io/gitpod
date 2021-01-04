// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package container

import (
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// NodeMountsLookupConfig confiugures the node mount/fs access
type NodeMountsLookupConfig struct {
	// ProcLoc is the path to the node's /proc/mounts -
	ProcLoc string `json:"proc"`
}

// Config configures the container runtime interface
type Config struct {
	// Mounts configures the node mounts lookup
	Mounts NodeMountsLookupConfig `json:"mounts"`

	// Mapping mapps a path from the node to the container by stripping the key and prepending the value of this map.
	// For example {"/var/lib/containerd": "/mnt/snapshots"} would translate /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/ to /mnt/snapshots/io.containerd.snapshotter.v1.overlayfs/snapshots/
	Mapping map[string]string `json:"nodeToContainerMapping"`

	// Runtime marks the container runtime we ought to connect to.
	// Depending on the value set here we expect the corresponding config struct to have a value.
	Runtime RuntimeType `json:"runtime"`

	// Containerd contains the containerd CRI config if runtime == RuntimeContainerd
	Containerd *ContainerdConfig `json:"containerd,omitempty"`
}

// RuntimeType lists the supported container runtimes
type RuntimeType string

const (
	// RuntimeContainerd connects to containerd
	RuntimeContainerd RuntimeType = "containerd"
)

// ContainerdConfig configures access to containerd
type ContainerdConfig struct {
	// SocketPath is the path in the local file system pointing to the containerd socket.
	// If this field is not set, full workspace backups are not available.
	SocketPath string `json:"socket"`
}

// FromConfig produces a container runtime interface instance from the configuration
func FromConfig(cfg *Config) (rt Runtime, err error) {
	if cfg == nil {
		return
	}

	mounts, err := NewNodeMountsLookup(&cfg.Mounts)
	if err != nil {
		return nil, err
	}

	switch cfg.Runtime {
	case RuntimeContainerd:
		if cfg.Containerd == nil {
			return nil, xerrors.Errorf("runtime is set to containerd, but not containerd config is provided")
		}
		return NewContainerd(cfg.Containerd, mounts, cfg.Mapping)
	default:
		return nil, xerrors.Errorf("unknown runtime type: %s", cfg.Runtime)
	}
}

// PathMapping maps a node path to a path in the container
type PathMapping map[string]string

// Translate maps a node-level (root mount namespace) path to a container-level path
func (mapping PathMapping) Translate(from string) (result string, err error) {
	for np, cp := range mapping {
		if !strings.HasPrefix(from, np) {
			continue
		}
		pth := filepath.Join(cp, strings.TrimPrefix(from, np))

		if _, err := os.Stat(pth); os.IsNotExist(err) {
			return "", xerrors.Errorf("path does not exist in container at %s", pth)
		} else if err != nil {
			return "", err
		}

		return pth, nil
	}

	return "", xerrors.Errorf("mount entry %s has no appropriate mapping", from)
}
