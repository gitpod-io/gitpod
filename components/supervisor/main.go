// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"time"

	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"
)

func main() {
	defer time.Sleep(5 * time.Minute)

	supervisor.Run()
}
