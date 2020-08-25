// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cri

import (
	"bufio"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"
)

// NewNodeMountsLookup produces a new node mounts lookup after validating the configuration
func NewNodeMountsLookup(cfg *NodeMountsLookupConfig) (*NodeMountsLookup, error) {
	if cfg == nil {
		return nil, xerrors.Errorf("config must not be nil")
	}
	if _, err := ioutil.ReadFile(cfg.ProcLoc); err != nil {
		return nil, xerrors.Errorf("cannot read mount table from %s: %w", cfg.ProcLoc, err)
	}
	for _, cp := range cfg.Mapping {
		if stat, err := os.Stat(cp); err != nil {
			return nil, xerrors.Errorf("invalid container prefix: %w", err)
		} else if !stat.IsDir() {
			return nil, xerrors.Errorf("container prefix is not a directory")
		}
	}

	return &NodeMountsLookup{cfg}, nil
}

// NodeMountsLookup interogates the node-level (root mount namespace) mount table and maps
// those paths to the container running this process.
type NodeMountsLookup struct {
	Config *NodeMountsLookupConfig
}

// GetUpperdir finds the upperdir of an overlayfs mount by matching the mountpoint
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

	return n.mapNodePath(pth)
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

// mapNodePath maps a node-level (root mount namespace) path to a container-level path
func (n *NodeMountsLookup) mapNodePath(nodePath string) (inContainerPath string, err error) {
	for np, cp := range n.Config.Mapping {
		if !strings.HasPrefix(nodePath, np) {
			continue
		}
		pth := filepath.Join(cp, strings.TrimPrefix(nodePath, np))

		if stat, err := os.Stat(pth); os.IsNotExist(err) {
			return "", xerrors.Errorf("mount entry does not exist in container at %s", pth)
		} else if err != nil {
			return "", err
		} else if !stat.IsDir() {
			return "", xerrors.Errorf("mount entry is not a directory in the container at %s", pth)
		}

		return pth, nil
	}

	return "", xerrors.Errorf("mount entry %s has no appropriate mapping", nodePath)
}
