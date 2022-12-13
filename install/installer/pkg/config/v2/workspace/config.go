// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

type Config struct {
	ObjectStorage ObjectStorage `json:"objectStorage" validate:"required"`

	Workspace Workspace `json:"workspace" validate:"required"`
}
