// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
)

func main() {
	log.Init("content-initializer", "", true, true)
	tracing.Init("content-initializer")

	err := content.RunInitializerChild()
	if err != nil {
		log.WithError(err).Error("content init failed")
		os.Exit(42)
	}
}
