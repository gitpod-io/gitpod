// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package containerd

import (
	"errors"
	"io/fs"
	"os"
)

// This is the default location - this will be used for most
const (
	ContainerdSocketLocationDefault ContainerdSocketLocation = "/run/containerd/containerd.sock"
	ContainerdLocationDefault       ContainerdLocation       = "/var/lib/containerd/io.containerd.runtime.v2.task/k8s.io"
)

// K3s
const (
	ContainerdSocketLocationK3s ContainerdSocketLocation = "/run/k3s/containerd/containerd.sock"
	ContainerdLocationK3s       ContainerdLocation       = "/run/k3s/containerd/io.containerd.runtime.v2.task/k8s.io"
)

// Amazon Linux
const (
	ContainerdLocationAmazonLinux ContainerdLocation = "/run/containerd/io.containerd.runtime.v2.task/k8s.io"
)

type ContainerdSocketLocation string
type ContainerdLocation string

func (s ContainerdSocketLocation) String() string {
	return string(s)
}

func (s ContainerdLocation) String() string {
	return string(s)
}

var (
	ErrContainerDLocation       = errors.New("cannot detect containerd location")
	ErrContainerDSocketLocation = errors.New("cannot detect containerd socket location")
)

func detectContainerdLocation() (*ContainerdLocation, error) {
	locations := []ContainerdLocation{
		ContainerdLocationK3s,
		ContainerdLocationAmazonLinux,
		ContainerdLocationDefault,
	}

	for _, location := range locations {
		// Ignore errors - the only error we're interested in is if cannot detect a location
		fileInfo, err := os.Stat(location.String())
		if err != nil || !fileInfo.IsDir() {
			// Not a directory - go to the next one
			continue
		}

		// We have a winner
		return &location, nil
	}

	return nil, ErrContainerDLocation
}

func detectContainerdSocketLocation() (*ContainerdSocketLocation, error) {
	locations := []ContainerdSocketLocation{
		ContainerdSocketLocationK3s,
		ContainerdSocketLocationDefault,
	}

	for _, location := range locations {
		// Ignore errors - the only error we're interested in is if cannot detect a location
		fileInfo, err := os.Stat(location.String())
		if err != nil || fileInfo.Mode().Type() != fs.ModeSocket {
			// Not a socket - go to the next one
			continue
		}

		// We have a winner
		return &location, nil
	}

	return nil, ErrContainerDSocketLocation
}

func Detect() (*ContainerdLocation, *ContainerdSocketLocation, error) {
	containerd, err := detectContainerdLocation()
	if err != nil {
		return nil, nil, err
	}
	socket, err := detectContainerdSocketLocation()
	if err != nil {
		return nil, nil, err
	}

	return containerd, socket, nil
}
