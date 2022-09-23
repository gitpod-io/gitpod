// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/components/easy/pkg/config"
	"github.com/gitpod-io/gitpod/components/easy/pkg/server"
)

func main() {
	version := "yolo"

	cfg, err := config.FromYAML("some/file/path")
	if err != nil {
		log.WithError(err).Fatal("Failed to parse config.")
	}

	err = server.ListenAndServe(cfg, version)
	if err != nil {
		log.WithError(err).Fatal("Failed to start server.")
	}
}
