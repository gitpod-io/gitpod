// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package metrics

import (
	"context"
	"os"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/push"
)

type Metrics struct {
	IDE    string
	pusher *push.Pusher

	ctx       context.Context
	wg        sync.WaitGroup
	ctxCancel context.CancelFunc

	phaseHistogram *prometheus.HistogramVec
}

func NewMetrics(IDE string) *Metrics {
	addr := os.Getenv("SUPERVISOR_ADDR")
	if addr == "" {
		addr = "localhost:22999"
	}
	pusher := push.New(addr, "codehelper")
	phaseHistogram := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "gitpod_ide_starthelper_phase_duration",
		Help:    "Duration of different phase during code startup",
		Buckets: []float64{0.01, 0.1, 0.2, 0.5, 2, 5, 10, 30, 60},
	}, []string{"phase", "ide"})

	pusher.Collector(phaseHistogram)
	ctx, cancel := context.WithCancel(context.Background())
	return &Metrics{
		IDE:            IDE,
		ctx:            ctx,
		ctxCancel:      cancel,
		pusher:         pusher,
		phaseHistogram: phaseHistogram,
	}
}

func (m *Metrics) Phase(phase string) context.CancelFunc {
	ctx, cancel := context.WithCancel(m.ctx)
	m.wg.Add(1)
	start := time.Now()
	log.WithField("phase", phase).Debug("phase start")
	go func() {
		<-ctx.Done()
		duration := time.Now().Local().Sub(start).Seconds()
		m.phaseHistogram.
			WithLabelValues(phase, m.IDE).
			Observe(duration)
		m.wg.Done()
		log.WithField("phase", phase).WithField("duration", duration).Debug("phase end")
	}()
	return cancel
}

func (m *Metrics) Send() error {
	m.ctxCancel()
	m.wg.Wait()
	err := m.pusher.Push()
	if err != nil {
		log.WithError(err).Error("failed to push to prometheus gateway")
	}
	return err
}
