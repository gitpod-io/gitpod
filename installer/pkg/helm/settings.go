// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package helm

import (
	"bytes"
	"fmt"
	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/cli"
	"helm.sh/helm/v3/pkg/cli/values"
	"log"
	"time"
)

type Config struct {
	Debug       bool
	KubeConfig  string
	KubeContext string
	Name        string
	Namespace   string
	Timeout     time.Duration
}

type Settings struct {
	ActionConfig *action.Configuration
	Chart        string
	Config       *Config
	Env          *cli.EnvSettings
	Values       *values.Options
}

func SettingsFactory(config *Config, chart string, vals *values.Options) Settings {
	if vals == nil {
		vals = &values.Options{}
	}

	settings := Settings{
		ActionConfig: new(action.Configuration),
		Config:       config,
		Env:          cli.New(),
		Chart:        chart, // This can be a directory or a change name
		Values:       vals,
	}

	if config.KubeConfig != "" {
		settings.Env.KubeConfig = config.KubeConfig
	}

	if config.KubeContext != "" {
		settings.Env.KubeContext = config.KubeContext
	}

	if !settings.Config.Debug {
		// If not debugging, send logs to a buffer
		log.SetOutput(&bytes.Buffer{})
	}

	return settings
}

func (settings *Settings) Write(format string, v ...interface{}) {
	format = fmt.Sprintf("[Gitpod] %s\n", format)
	log.Output(2, fmt.Sprintf(format, v...))
}
