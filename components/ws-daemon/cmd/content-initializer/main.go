// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	log.Init("content-initializer", "", true, false)
	tracing.Init("content-initializer")

	statsFd := os.NewFile(content.RUN_INITIALIZER_CHILD_STATS_FD, "stats")

	err := content.RunInitializerChild(statsFd)
	if err != nil {
		errfd := os.NewFile(content.RUN_INITIALIZER_CHILD_ERROUT_FD, "errout")
		_, _ = fmt.Fprintf(errfd, err.Error())

		os.Exit(content.FAIL_CONTENT_INITIALIZER_EXIT_CODE)
	}
}
