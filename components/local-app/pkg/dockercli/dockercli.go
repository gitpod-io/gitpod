// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dockercli

import (
	"encoding/json"

	"github.com/gitpod-io/local-app/pkg/dockercli/porcelain"
)

type CLI interface {
	ContainerList(opts porcelain.ContainerLsOpts) ([]DockerContainer, error)
}

type DockerContainer struct {
	Command      string `json:"Command"`
	CreatedAt    string `json:"CreatedAt"`
	ID           string `json:"ID"`
	Image        string `json:"Image"`
	Labels       string `json:"Labels"`
	LocalVolumes string `json:"LocalVolumes"`
	Mounts       string `json:"Mounts"`
	Names        string `json:"Names"`
	Networks     string `json:"Networks"`
	Ports        string `json:"Ports"`
	RunningFor   string `json:"RunningFor"`
	Size         string `json:"Size"`
	State        string `json:"State"`
	Status       string `json:"Status"`
}

var Docker CLI = nativeCLI{}

type nativeCLI struct{}

func (nativeCLI) ContainerList(opts porcelain.ContainerLsOpts) ([]DockerContainer, error) {
	opts.Format = "json"
	out, err := porcelain.ContainerLs(&opts)
	if err != nil {
		return nil, err
	}
	var res []DockerContainer
	err = json.Unmarshal([]byte(out), &res)
	if err != nil {
		return nil, err
	}
	return res, nil
}
