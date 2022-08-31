// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package contentservice

import (
	"fmt"
	"github.com/prometheus/client_golang/prometheus"
	"time"
)

const (
	namespace = "gitpod"
	subsystem = "usage"
)

var (
	reportUploadDurationSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "report_upload_duration_seconds",
		Help:      "Histogram of time it takes (in seconds) to upload a usage report to content service",
	}, []string{"outcome"})

	reportDownloadDurationSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "report_download_duration_seconds",
		Help:      "Histogram of time it takes (in seconds) to download usage report from content service",
	}, []string{"outcome"})
)

func RegisterMetrics(reg *prometheus.Registry) error {
	metrics := []prometheus.Collector{
		reportUploadDurationSeconds,
		reportDownloadDurationSeconds,
	}
	for _, metric := range metrics {
		err := reg.Register(metric)
		if err != nil {
			return fmt.Errorf("failed to register metric: %w", err)
		}
	}

	return nil
}

func observeReportUploadDuration(d time.Duration, err error) {
	outcome := "ok"
	if err != nil {
		outcome = "error"
	}
	reportUploadDurationSeconds.WithLabelValues(outcome).Observe(d.Seconds())
}

func observeReportDownloadDuration(d time.Duration, err error) {
	outcome := "ok"
	if err != nil {
		outcome = "error"
	}
	reportDownloadDurationSeconds.WithLabelValues(outcome).Observe(d.Seconds())
}
