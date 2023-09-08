// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import "github.com/gitpod-io/gitpod/common-go/baseserver"

const (
	Component               = "ws-daemon"
	ServicePort             = 8080
	HostWorkingAreaMk2      = "/var/gitpod/workspaces-mk2"
	ContainerWorkingAreaMk2 = "/mnt/workingarea-mk2"
	HostBackupPath          = "/var/gitpod/tmp/backup"
	TLSSecretName           = "ws-daemon-tls"
	VolumeTLSCerts          = "ws-daemon-tls-certs"
	HostGitpodImagesConfig  = "/etc/gitpod/config"
	ReadinessPort           = baseserver.BuiltinHealthPort
)
