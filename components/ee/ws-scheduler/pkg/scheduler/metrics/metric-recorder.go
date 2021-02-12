// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

type MetricRecorder interface {
	Inc()
	Dec()
	Clear()
}

type PendingPodsRecorder struct {
	recorder prometheus.Gauge
}

func NewActivePodsRecorder() *PendingPodsRecorder {
	return &PendingPodsRecorder{
		recorder: PendingPods.WithLabelValues("queue", "active"),
	}
}

func NewBackoffPodsRecorder() *PendingPodsRecorder {
	return &PendingPodsRecorder{
		recorder: PendingPods.WithLabelValues("queue", "backoff"),
	}
}

func (r *PendingPodsRecorder) Inc() {
	r.recorder.Inc()
}

func (r *PendingPodsRecorder) Dec() {
	r.recorder.Dec()
}

func (r *PendingPodsRecorder) Clear() {
	r.recorder.Set(float64(0))
}
