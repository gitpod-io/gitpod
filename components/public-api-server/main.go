// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/server"
)

func main() {
	logger := log.New()

	if err := server.Start(logger); err != nil {
		logger.WithError(err).Fatal("Server errored.")
	}
}
