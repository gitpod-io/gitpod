// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package rings

import "github.com/gitpod-io/gitpod/ws-daemon/api"

type SyncMsg struct {
	Stage   int               `json:"stage"`
	Rootfs  string            `json:"rootfs"`
	FSShift api.FSShiftMethod `json:"fsshift"`
}
