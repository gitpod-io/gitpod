// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package stripe

import (
	"fmt"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	stripeUsageUpdateTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "gitpod",
		Subsystem: "stripe",
		Name:      "usage_records_updated_total",
		Help:      "Counter of usage records updated",
	}, []string{"outcome"})
)

func RegisterMetrics(reg *prometheus.Registry) error {
	metrics := []prometheus.Collector{
		stripeUsageUpdateTotal,
	}
	for _, metric := range metrics {
		err := reg.Register(metric)
		if err != nil {
			return fmt.Errorf("failed to register metric: %w", err)
		}
	}

	return nil
}

func reportStripeUsageUpdate(err error) {
	outcome := "success"
	if err != nil {
		outcome = "fail"
	}
	stripeUsageUpdateTotal.WithLabelValues(outcome).Inc()
}
