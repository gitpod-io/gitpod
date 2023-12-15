// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"net/url"
	"os"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
)

var (
	// ServiceName is the name we use for tracing/logging.
	ServiceName = "codehelper"
	// Version of this service - set during build.
	Version = ""
)

const (
	Code                     = "/ide/bin/gitpod-code"
	ProductJsonLocation      = "/ide/product.json"
	WebWorkbenchMainLocation = "/ide/out/vs/workbench/workbench.web.main.js"
	ServerMainLocation       = "/ide/out/vs/server/node/server.main.js"
)

func main() {
	enableDebug := os.Getenv("SUPERVISOR_DEBUG_ENABLE") == "true"

	log.Init(ServiceName, Version, true, enableDebug)
	log.Info("codehelper started")
	startTime := time.Now()
	gitpodHost := os.Getenv("GITPOD_HOST")
	url, err := url.Parse(gitpodHost)
	if err != nil {
		log.WithError(err).Errorf("failed to parse GitpodHost %s", gitpodHost)
		return
	}
	domain := url.Hostname()

	// code server args install extension with id
	args := []string{}

	if enableDebug {
		args = append(args, "--inspect", "--log=trace")
	} else {
		switch log.Log.Logger.GetLevel() {
		case logrus.PanicLevel:
			args = append(args, "--log=critical")
		case logrus.FatalLevel:
			args = append(args, "--log=critical")
		case logrus.ErrorLevel:
			args = append(args, "--log=error")
		case logrus.WarnLevel:
			args = append(args, "--log=warn")
		case logrus.InfoLevel:
			args = append(args, "--log=info")
		case logrus.DebugLevel:
			args = append(args, "--log=debug")
		case logrus.TraceLevel:
			args = append(args, "--log=trace")
		}
	}

	args = append(args, "--install-builtin-extension", "gitpod.gitpod-theme")

	contextUrl := os.Getenv("GITPOD_WORKSPACE_CONTEXT_URL")
	if ctxUrl, err := url.Parse(contextUrl); err == nil {
		if ctxUrl.Host == "github.com" {
			log.Info("ws context url is from github.com, install builtin extension github.vscode-pull-request-github")
			args = append(args, "--install-builtin-extension", "github.vscode-pull-request-github")
		}
	} else {
		log.WithError(err).WithField("wsContextUrl", contextUrl).Error("parse ws context url failed")
	}

	// install extensions and run code server with exec
	args = append(args, os.Args[1:]...)
	args = append(args, "--do-not-sync")
	args = append(args, "--start-server")
	cmdEnv := append(os.Environ(), fmt.Sprintf("GITPOD_CODE_HOST=%s", domain))
	log.WithField("cost", time.Now().Local().Sub(startTime).Milliseconds()).Info("starting server")
	if err := syscall.Exec(Code, append([]string{"gitpod-code"}, args...), cmdEnv); err != nil {
		log.WithError(err).Error("install ext and start code server failed")
	}
}
