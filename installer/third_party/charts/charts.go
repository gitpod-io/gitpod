// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

type Chart struct {
	// Name of the Helm chart - this is free text, but should be the name
	Name string
	// Embedded Chart.yaml file
	Chart []byte
	// Embedded values.yaml file
	Values []byte
	// Any custom YAML files that would be applied via "kubectl apply -f"
	KubeObjects [][]byte
}
