// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"os"

	"github.com/sirupsen/logrus"

	"github.com/gitpod-io/gitpod/previewctl/cmd"
)

func main() {
	logger := logrus.New()
	logger.SetFormatter(&logrus.TextFormatter{
		DisableColors:   true,
		FullTimestamp:   true,
		TimestampFormat: "2006-01-02 15:04:05",
	})

	if os.Getenv("GOOGLE_APPLICATION_CREDENTIALS") == "" {
		if credFile := os.Getenv("PREVIEW_ENV_DEV_SA_KEY_PATH"); credFile != "" {
			_, err := os.Stat(credFile)
			if err == nil {
				os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", credFile)
			}
		}
	}

	root := cmd.NewRootCmd(logger)
	if err := root.Execute(); err != nil {
		logger.WithFields(logrus.Fields{"err": err}).Fatal("command failed.")
	}
}
