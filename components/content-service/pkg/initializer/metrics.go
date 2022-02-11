// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"github.com/prometheus/client_golang/prometheus"
)

type initializer_metrics struct {
	DownloadOTSCounter *prometheus.CounterVec
}

var metrics *initializer_metrics

func NewMetrics(reg prometheus.Registerer) error {
	downloadOTSCounter := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "req_download_ots_total",
			Help: "number of download ots requests",
		}, []string{"type"},
	)
	err := reg.Register(downloadOTSCounter)
	if err != nil {
		return err
	}

	metrics = &initializer_metrics{
		DownloadOTSCounter: downloadOTSCounter,
	}
	return nil
}
