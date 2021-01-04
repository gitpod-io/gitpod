// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package container

import (
	"bufio"
	"os"
	"strings"

	"golang.org/x/xerrors"
)

// NewNodeMountsLookup produces a new node mounts lookup after validating the configuration
func NewNodeMountsLookup(cfg *NodeMountsLookupConfig) (*NodeMountsLookup, error) {
	if cfg == nil {
		return nil, xerrors.Errorf("config must not be nil")
	}

	return &NodeMountsLookup{cfg}, nil
}

// NodeMountsLookup interogates the node-level (root mount namespace) mount table and maps
// those paths to the container running this process.
type NodeMountsLookup struct {
	Config *NodeMountsLookupConfig
}

// GetMountpoint scans the mount table for a mount point and returns one if found
func (n *NodeMountsLookup) GetMountpoint(matcher func(mountPoint string) bool) (mountPoint string, err error) {
	entry, err := n.getEntry(matcher)
	if err != nil {
		return
	}

	return entry[1], nil
}

// GetUpperdir finds the upperdir of an overlayfs mount by matching the mountpoint.
// The returned path exists in the node's root mount namespace.
func (n *NodeMountsLookup) GetUpperdir(matcher func(mountPoint string) bool) (upperdir string, err error) {
	entry, err := n.getEntry(matcher)
	if err != nil {
		return
	}

	var pth string
	segs := strings.Split(entry[3], ",")
	for _, seg := range segs {
		if !strings.HasPrefix(seg, "upperdir=") {
			continue
		}

		pth = strings.TrimSpace(strings.TrimPrefix(seg, "upperdir="))
		break
	}
	if pth == "" {
		return "", ErrNoUpperdir
	}

	return pth, nil
}

func (n *NodeMountsLookup) getEntry(matcher func(mountPoint string) bool) (entry []string, err error) {
	f, err := os.Open(n.Config.ProcLoc)
	if err != nil {
		return nil, xerrors.Errorf("cannot load node mounts: %w", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)

		if len(fields) < 4 {
			continue
		}
		if fields[0] != "overlay" {
			continue
		}
		if !matcher(fields[1]) {
			continue
		}

		return fields, nil
	}

	return nil, ErrNotFound
}
