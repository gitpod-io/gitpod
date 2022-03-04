// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package registration

import (
	"errors"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/kedge/pkg/kedge"
	"golang.org/x/xerrors"
	"k8s.io/client-go/kubernetes"
)

// CollectorPool regularly collects and installs services from collectors
type CollectorPool struct {
	Clientset        kubernetes.Interface
	Namespace        string
	StaticCollectors []kedge.Collector
	Store            Store
	ServiceNotifier  ServiceNotifier

	FailureTTLService   int
	FailureTTLCollector int

	failureCount map[string]int
	mu           sync.Mutex
}

// Start runs the collector pool until done closed. This function does not return
// until done is closed and is expected to be called as a Go routine.
func (c *CollectorPool) Start(period time.Duration) {
	ticker := time.NewTicker(period)
	defer ticker.Stop()

	for {
		log.Debug("collecting and installing services")
		for _, collector := range c.StaticCollectors {
			err := c.collect(collector, false)
			if err != nil {
				log.WithError(err).WithField("name", collector.Name).Warn("collector error")
			}
		}

		dcs, err := c.Store.List()
		if err != nil {
			log.WithError(err).Warn("cannot list dynamically configured collector - resorting to static ones only")
		}
		for _, collector := range dcs {
			c.collect(collector, true)
		}

		<-ticker.C
	}
}

// AddCollector adds a new collector to this pool
func (c *CollectorPool) AddCollector(collector kedge.Collector) error {
	err := c.Store.Add(collector)
	if err != nil {
		return xerrors.Errorf("cannot add collector: %w", err)
	}

	err = c.collect(collector, true)
	if err != nil {
		return xerrors.Errorf("initial collection failed: %w", err)
	}

	return nil
}

func (c *CollectorPool) collect(collector kedge.Collector, isDynamic bool) error {
	name := collector.Name

	newServices, err := collector.CollectAndInstall(c.Clientset, c.Namespace)
	var e *kedge.ErrCollectionFailed

	c.mu.Lock()
	defer c.mu.Unlock()
	if c.failureCount == nil {
		c.failureCount = make(map[string]int)
	}

	if errors.As(err, &e) {
		// collection failed - if we've reached one of our tolerance limits, act accordingly
		failures := c.failureCount[name]
		failures++
		c.failureCount[name] = failures

		collectorFailure := isDynamic && failures >= c.FailureTTLCollector
		log := log.WithError(err).WithField("collector", name).WithField("failures", failures)

		log.Warn("collection failed")
		if collectorFailure {
			log.Warn("removing dynamic collector")
			err = c.Store.Remove(name)
			if err != nil {
				return xerrors.Errorf("cannot remove failed collector from store: %w", err)
			}
		}
		if failures >= c.FailureTTLService || collectorFailure {
			log.Warn("removing collected services")
			err = kedge.ClearServices(c.Clientset, c.Namespace, name)
			if err != nil {
				return xerrors.Errorf("cannot clear previously collected services: %w", err)
			}
		}

		return nil
	}
	// collection was successful - reset failure count
	delete(c.failureCount, name)

	// maybe the install failed though
	if err != nil {
		return xerrors.Errorf("cannot install service endpoints: %w", err)
	}

	// everything went according to plan - let's tell the world
	if c.ServiceNotifier != nil {
		go func() {
			for _, ns := range newServices {
				c.ServiceNotifier.OnNewService(ns)
			}
		}()
	}

	return nil
}
