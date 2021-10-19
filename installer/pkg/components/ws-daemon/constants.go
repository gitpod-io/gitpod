// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsdaemon

const (
	Component         = "ws-daemon"
	ServicePort       = 8080
	HostWorkspacePath = "/var/gitpod/workspaces"
	TLSSecretName     = "ws-daemon-tls"
	VolumeTLSCerts    = "ws-daemon-tls-certs"
)
