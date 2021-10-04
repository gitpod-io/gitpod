// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package helm

import (
	"fmt"
	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/cli"
	"log"
)

type Settings struct {
	ActionConfig *action.Configuration
	Chart        string
	Config       *Config
	Env          *cli.EnvSettings
	Values       []string // todo(sje) work out this type
}

func (settings *Settings) Write(format string, v ...interface{}) {
	format = fmt.Sprintf("[Gitpod] %s\n", format)
	log.Output(2, fmt.Sprintf(format, v...))
}
