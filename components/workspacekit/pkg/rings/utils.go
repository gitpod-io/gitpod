// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package rings

import (
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
)

func HandleExit(ec *int) {
	exitCode := *ec
	if exitCode != 0 {
		sleepForDebugging()
	}
	os.Exit(exitCode)
}

func sleepForDebugging() {
	if os.Getenv("GITPOD_WORKSPACEKIT_SLEEP_FOR_DEBUGGING") != "true" {
		return
	}

	log.Info("sleeping five minutes to allow debugging")
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	select {
	case <-sigChan:
	case <-time.After(5 * time.Minute):
	}
}
