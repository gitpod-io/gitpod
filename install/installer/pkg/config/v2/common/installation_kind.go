// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

type InstallationKind string

const (
	InstallationIDE       InstallationKind = "IDE"
	InstallationWebApp    InstallationKind = "WebApp"
	InstallationMeta      InstallationKind = "Meta" // IDE plus WebApp components
	InstallationWorkspace InstallationKind = "Workspace"
	InstallationFull      InstallationKind = "Full"
)
