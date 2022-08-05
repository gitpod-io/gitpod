// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ide_proxy

const (
	Component          = "ide-proxy"
	ContainerHTTPPort  = 80
	ContainerHTTPSPort = 443
	ContainerHTTPName  = "http"
	ContainerHTTPSName = "https"
	ReadinessPort      = 8080
	ServicePort        = ContainerHTTPPort
)
