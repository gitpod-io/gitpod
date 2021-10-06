// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

const (
	Component                  = "ws-manager"
	RPCPort                    = 8080
	TLSSecretNameSecret        = "ws-manager-tls"
	TLSSecretNameClient        = "ws-manager-client-tls"
	VolumeConfig               = "config"
	VolumeTLSCerts             = "tls-certs"
	VolumeWorkspaceTemplate    = "workspace-template"
	WorkspaceTemplatePath      = "/workspace-templates"
	WorkspaceTemplateConfigMap = "workspace-templates"
)
