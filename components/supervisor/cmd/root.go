// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "supervisor",
	Short: "Workspace container init process",
}

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "supervisor"
	// Version of this service - set during build
	Version = ""
)

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	log.Init(ServiceName, Version, true, false)
	log.Log.Logger.AddHook(fatalTerminationLogHook{})

	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

type fatalTerminationLogHook struct{}

func (fatalTerminationLogHook) Levels() []logrus.Level {
	return []logrus.Level{logrus.FatalLevel}
}

func (fatalTerminationLogHook) Fire(e *logrus.Entry) error {
	msg := e.Message
	if err := e.Data[logrus.ErrorKey]; err != nil {
		msg += ": " + err.(error).Error()
	}

	return os.WriteFile("/dev/termination-log", []byte(msg), 0644)
}
