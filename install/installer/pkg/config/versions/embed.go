// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build embedVersion

package versions

import (
	_ "embed"

	"sigs.k8s.io/yaml"
)

//go:embed versions.yaml
var embeddedVersion []byte

func loadEmbedded() (*Manifest, error) {
	var res Manifest
	err := yaml.Unmarshal(embeddedVersion, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}
