// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package containerd

import (
	"errors"
	"io/fs"
	"os"
	"path"
)

var (
	ErrContainerDLocation       = errors.New("cannot detect containerd location")
	ErrContainerDSocketLocation = errors.New("cannot detect containerd socket location")
)

// This is the default location - this will be used for most installations
const (
	ContainerdSocketLocationDefault ContainerdSocketLocation = "/run/containerd"
	ContainerdLocationDefault       ContainerdLocation       = "/var/lib/containerd/io.containerd.runtime.v2.task/k8s.io"
)

type ContainerdSocketLocation string
type ContainerdLocation string

func (s ContainerdSocketLocation) String() string {
	return string(s)
}

func (s ContainerdLocation) String() string {
	return string(s)
}

var loc locations

type locations struct {
	socket     []ContainerdSocketLocation
	containerd []ContainerdLocation
}

func (l *locations) AddContainerd(containerd ContainerdLocation) {
	l.containerd = append(l.containerd, containerd)
}

func (l *locations) AddSocket(socket ContainerdSocketLocation) {
	l.socket = append(l.socket, socket)
}

// GetContainerdList return the containerd locations with the default location appended
func (l *locations) GetContainerdList() []ContainerdLocation {
	c := l.containerd
	c = append(c, ContainerdLocationDefault)
	return c
}

// GetSocketList return the socket locations with the default location appended
func (l *locations) GetSocketList() []ContainerdSocketLocation {
	s := l.socket
	s = append(s, ContainerdSocketLocationDefault)
	return s
}

func detectContainerdLocation(mountPath string) (*ContainerdLocation, error) {
	for _, location := range loc.GetContainerdList() {
		// Ignore errors - the only error we're interested in is if cannot detect a location
		fileInfo, err := os.Stat(path.Join(mountPath, location.String()))
		if err != nil || !fileInfo.IsDir() {
			// Not a directory - go to the next one
			continue
		}

		// We have a winner
		return &location, nil
	}

	return nil, ErrContainerDLocation
}

func detectContainerdSocketLocation(mountPath string) (*ContainerdSocketLocation, error) {
	for _, location := range loc.GetSocketList() {
		// Ignore errors - the only error we're interested in is if cannot detect a location
		fileInfo, err := os.Stat(path.Join(mountPath, location.String()))
		if err != nil || fileInfo.Mode().Type() != fs.ModeSocket {
			// Not a socket - go to the next one
			continue
		}

		// We have a winner
		return &location, nil
	}

	return nil, ErrContainerDSocketLocation
}

func Detect(mountPath string) (*ContainerdLocation, *ContainerdSocketLocation, error) {
	containerd, err := detectContainerdLocation(mountPath)
	if err != nil {
		return nil, nil, err
	}
	socket, err := detectContainerdSocketLocation(mountPath)
	if err != nil {
		return nil, nil, err
	}

	return containerd, socket, nil
}
