// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package utils

import "os"

func IsRunningInDebugWorkspace() bool {
	return os.Getenv("SUPERVISOR_DEBUG_WORKSPACE") == "true"
}
