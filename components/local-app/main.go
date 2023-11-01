// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"github.com/gitpod-io/local-app/cmd"
	"github.com/gitpod-io/local-app/pkg/constants"
	"github.com/gitpod-io/local-app/pkg/localapp"
)

func main() {
	if constants.Flavor == "gitpod-cli" {
		cmd.Execute()
	} else {
		localapp.RunCommand()
	}
}
