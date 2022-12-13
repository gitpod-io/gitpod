// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package webapp

import "github.com/gitpod-io/gitpod/installer/pkg/config/v2/common"

type Database struct {
	InCluster *bool             `json:"inCluster,omitempty"`
	External  *DatabaseExternal `json:"external,omitempty"`
	CloudSQL  *DatabaseCloudSQL `json:"cloudSQL,omitempty"`
}

type DatabaseExternal struct {
	Certificate common.ObjectRef `json:"certificate"`
}

type DatabaseCloudSQL struct {
	ServiceAccount common.ObjectRef `json:"serviceAccount"`
	Instance       string           `json:"instance" validate:"required"`
}
