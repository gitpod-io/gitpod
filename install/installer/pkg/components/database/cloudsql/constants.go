// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cloudsql

const (
	Component = "cloudsqlproxy"
	ImageRepo = "b.gcr.io/cloudsql-docker"
	ImageName = "gce-proxy"
	// https://console.cloud.google.com/gcr/images/cloudsql-docker/global/gce-proxy@sha256:90349f187d20f830168c6d2abe566c05be8dcadbe0df6b9bc1d63327cfc20461/details
	ImageVersion = "1.33.8-alpine"
	Port         = 3306
)
