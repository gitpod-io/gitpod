// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package main

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gitpod-io/gitpod/cerc/pkg/cerc"
	"github.com/gitpod-io/gitpod/cerc/pkg/reporter/httpendpoint"
	"github.com/gitpod-io/gitpod/cerc/pkg/reporter/prometheus"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Config configrues the cerc service
type Config struct {
	Service   cerc.Options `json:"service"`
	Reporting struct {
		Log          bool `json:"log,omitempty"`
		Prometheus   bool `json:"prometheus,omitempty"`
		HTTPEndpoint bool `json:"httpEndpoint,omitempty"`
	} `json:"reporting"`
	PProfAddr   string `json:"pprof,omitempty"`
	JSONLogging bool   `json:"jsonLogging,omitempty"`
}

func main() {
	if len(os.Args) < 2 || os.Args[1] == "-h" || os.Args[1] == "--help" || os.Args[1] == "help" {
		log.Fatalf("usage: %s <config.json>", os.Args[0])
	}

	fc, err := ioutil.ReadFile(os.Args[1])
	if err != nil {
		log.WithError(err).Fatal("cannot read configuration")
	}

	var cfg Config
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		log.WithError(err).Fatal("cannot read configuration")
	}

	if cfg.JSONLogging {
		log.Init("cerc", "", cfg.JSONLogging, cfg.JSONLogging)
	}

	mux := http.NewServeMux()
	go func() {
		err := http.ListenAndServe(cfg.Service.Address, mux)
		log.WithError(err).Fatal("cannot run service")
	}()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.WithField("path", r.URL.Path).Warning("404 – not found")
	})

	var reporter []cerc.Reporter
	if cfg.Reporting.Log {
		reporter = append(reporter, loggingReporter{})
	}
	if cfg.Reporting.Prometheus {
		mux.Handle("/metrics", promhttp.Handler())

		rep, err := prometheus.StartReporter(cfg.Service.Pathways)
		if err != nil {
			log.WithError(err).Fatal("Prometheus reporter failed to start - exiting")
			return
		}
		reporter = append(reporter, rep)
	}
	if cfg.Reporting.HTTPEndpoint {
		rep := httpendpoint.NewReporter()
		mux.HandleFunc("/status", rep.Serve)
		reporter = append(reporter, rep)
	}

	c, err := cerc.Start(cfg.Service, cerc.NewCompositeReporter(reporter...), mux)
	if err != nil {
		log.WithError(err).Fatal("cannot start cerc service")
	}

	if cfg.PProfAddr != "" {
		go pprof.Serve(cfg.PProfAddr)
	}

	log.WithField("address", c.Config.Address).Info("cerc is up and running")
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan
}

type loggingReporter struct{}

func (loggingReporter) ProbeStarted(pathway string) {}
func (loggingReporter) ProbeFinished(report cerc.Report) {
	switch report.Result {
	case cerc.ProbeSuccess:
		log.WithField("pathway", report.Pathway).WithField("duration", report.Duration).Info("circle complete")
	case cerc.ProbeFailure:
		log.WithField("pathway", report.Pathway).WithField("duration", report.Duration).WithField("reason", report.Message).Warn("pathway probe failed")
	case cerc.ProbeNonStarter:
		log.WithField("pathway", report.Pathway).WithField("reason", report.Message).Warn("pathway probe failed to start")
	}
}
