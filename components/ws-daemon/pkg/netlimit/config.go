// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package netlimit

type Config struct {
	Enabled              bool  `json:"enabled"`
	Enforce              bool  `json:"enforce"`
	ConnectionsPerMinute int64 `json:"connectionsPerMinute"`
	BucketSize           int64 `json:"bucketSize"`
}
