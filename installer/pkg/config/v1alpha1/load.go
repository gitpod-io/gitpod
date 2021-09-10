// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"io/ioutil"

	"k8s.io/utils/pointer"
	"sigs.k8s.io/yaml"
)

func Load(fn string) (*Config, error) {
	fc, err := ioutil.ReadFile(fn)
	if err != nil {
		return nil, err
	}

	var cfg Config
	err = yaml.UnmarshalStrict(fc, &cfg)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// LoadMock produces a valid but non-sensical configuration useful for testing
func LoadMock() *Config {
	return &Config{
		Kind:   InstallationFull,
		Domain: "gitpod-testing.com",
		Metadata: Metadata{
			Region: "eu-west1",
		},
		Repository: "eu.gcr.io/gitpod-core-dev/build",
		Observability: Observability{
			LogLevel: "debug",
		},
		Database: Database{
			InCluster: pointer.Bool(true),
		},
		ObjectStorage: ObjectStorage{
			InCluster: pointer.Bool(true),
		},
		ContainerRegistry: ContainerRegistry{
			InCluster: pointer.Bool(true),
		},
		Certificate: ObjectRef{
			Name: "https-certs",
		},
		Workspace: Workspace{
			Runtime: WorkspaceRuntime{
				FSShiftMethod: FSShiftFuseFS,
				ContainerDRuntimeDir: "/run/containerd/io.containerd.runtime.v2.task/k8s.io",
			},
		},
	}
}
