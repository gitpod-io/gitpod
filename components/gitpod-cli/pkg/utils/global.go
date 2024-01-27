// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package utils

import (
	"time"
)

var TrackCommandUsageEvent = &TrackCommandUsageParams{
	Timestamp: time.Now().UnixMilli(),
}
