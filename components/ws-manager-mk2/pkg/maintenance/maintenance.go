// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package maintenance

import "context"

// Maintenance is used to check whether ws-manager-mk2 is in maintenance mode,
// which prevents pod creation/deletion and snapshots being taken, such that
// the cluster can be updated in-place.
type Maintenance interface {
	IsEnabled(ctx context.Context) bool
}
