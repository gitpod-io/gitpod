// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/openvsx-proxy/pkg"
	"github.com/sirupsen/logrus"
)

func main() {
	log.Init("openvsx-proxy", "", true, false)

	if len(os.Args) != 2 {
		log.Panicf("Usage: %s </path/to/config.json>", os.Args[0])
	}

	cfg, err := pkg.ReadConfig(os.Args[1])
	if err != nil {
		log.WithError(err).Panic("error reading config 😢")
	}

	if cfg.LogDebug {
		log.Log.Logger.SetLevel(logrus.DebugLevel)
	}

	log.WithField("config", string(cfg.ToJson())).Info("starting OpenVSX proxy 🚀 ...")

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	openVSXProxy := pkg.OpenVSXProxy{
		Config: cfg,
	}
	shutdown, err := openVSXProxy.Start()
	if err != nil {
		log.WithError(err).Panic("failed to start OpenVSX proxy 😢")
	}

	log.Info("OpenVSX proxy has been started ... listening on port 8080 ☕ ...")

	<-done
	log.Info("shutting down OpenVSX proxy ...")
	startShutdown := time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer func() {
		cancel()
	}()

	if err := shutdown(ctx); err != nil {
		log.
			WithError(err).
			WithField("shutdown_duration", time.Since(startShutdown).String()).
			Error("gracefully shutting down of OpenVSX proxy failed 😢")
		return
	}

	log.
		WithField("shutdown_duration", time.Since(startShutdown).String()).
		Info("OpenVSX proxy has been stopped 👋")
}
