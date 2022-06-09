// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

type GitpodImages struct {
	Supervisor string `json:"supervisor"`
	WebIDE     string `json:"vsCodeWeb"`
}

var DefaultImages = GitpodImages{
	Supervisor: "5000-gitpodio-gitpod-qn031ezltwt.ws-eu47.gitpod.io/supervisor:dev",
	WebIDE:     "eu.gcr.io/gitpod-core-dev/build/ide/code:commit-86282e8b797054f1f8db1f902d3b16b3d121710d",
}
