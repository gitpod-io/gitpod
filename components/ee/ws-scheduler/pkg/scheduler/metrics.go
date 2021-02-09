// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"

	k8sschedmetrics "k8s.io/kubernetes/pkg/scheduler/metrics"
)

// CompositeGatherer combines multiple Gatherer into one.
// This is useful to re-use the k8s internal "global" metrics registry.
// Note: Assumes metrics to be disjunct!
type CompositeGatherer struct {
	gatherers []prometheus.Gatherer
}

// make sure we implement the interface properly
var _ prometheus.Gatherer = &CompositeGatherer{}

func NewCompositeGatherer(gatherers ...prometheus.Gatherer) *CompositeGatherer {
	return &CompositeGatherer{
		gatherers,
	}
}

func (mg *CompositeGatherer) Gather() ([]*dto.MetricFamily, error) {
	var result []*dto.MetricFamily
	for _, g := range mg.gatherers {
		families, err := g.Gather()
		if err != nil {
			return nil, err
		}
		result = append(result, families...)
	}

	return result, nil
}

// MustRegister registers all scheduler metrics with the retunred Gatherer and panics if there is an error.
// This includes:
//  - prometheus.NewGoCollector(),
//  - prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}),
func (s *Scheduler) MustRegister() prometheus.Gatherer {
	// we're re-using the k8s-interal "global" registry
	k8sschedmetrics.Register()

	return k8sschedmetrics.GetGather()
}
