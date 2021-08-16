// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package clock

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// This clock roughly implements a Hybrid Logical Clock (HLC) as described in
//   Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases
//   Kulkarni et al.
//   https://cse.buffalo.edu/tech-reports/2014-04.pdf
//
// This implementation is very much geared towards single process use, yet still
// protects us from the funny bits of physical wall time, e.g. clock skew or time
// running backwards. Also, this implementation is naively synchronised using a simple mutex.
//
// In the future, if we ever make ws-manager properly distributed, we might want
// to take inspiration from cockroachDB's implementation:
//     https://github.com/cockroachdb/cockroach/blob/master/pkg/util/hlc/hlc.go
type HLC struct {
	physicalTime          func() uint64
	backwardsFlowReporter func(diff uint64)

	mu struct {
		sync.Mutex

		lastPhysicalTime uint64
		lc               uint64
	}
}

// System takes the wall time from the actual system time.
// Beware: when using the clock wall time, it's a good idea to wait out
//         the maximum expected real wall time skew, e.g. as imposed by
//         NTP. time.Sleep(2*time.Second) should be enough in most cases.
func System() *HLC {
	return &HLC{
		physicalTime: func() uint64 { return uint64(time.Now().Unix()) },
	}
}

// LogicalOnly includes no system time and resorts to the logical clock only.
// NEVER USE THIS IN PRODUCTION!
func LogicalOnly() *HLC {
	return &HLC{physicalTime: func() uint64 { return 1 }}
}

const (
	physicalTimeMask = 0xFFFFFFFFFFFF
	logicalTimeMask  = 0xFFFF
)

// ReportBackwardsTime registers a reporter which gets called when the wall time
// does not increase monotonously.
// Beware: this function is not synchronised with Tick() and must not be called
//         concurrently.
func (c *HLC) ReportBackwardsTime(r func(diff uint64)) {
	c.backwardsFlowReporter = r
}

func (c *HLC) Tick() uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()

	// We trade of physical and logical clock precision here.
	// The logical clock only has to cover all events happening while
	// time is runninig backwards (e.g. after/during an NTP re-sync).
	t := c.physicalTime() & physicalTimeMask

	if t == 0 {
		panic("physical time must never be 0")
	}

	if c.mu.lastPhysicalTime >= t {
		if c.mu.lc >= logicalTimeMask {
			// If this happens the logical clock cannot compensate for the physical wall clock skew.
			// We want to be loud about this because this should never happen.
			// In reality, the panic will probably restart the service which will let the wall clock
			// skew seep in and thereby destroy the order guarantees this clock is supposed to provide.
			// However, if the wall clock has been off for more than 65535 events, something is probably
			// wrong on that node to begin with.
			//
			// TODO(cw): If this happens too often, we'll want to introduce forward time jump detection for the
			// 			 wall clock. Maybe time isn't running backwards, but rather jumping forwards and then
			//           standing still.
			panic("logical clock overflow")
		}

		// time is moving backwards. We might want to report this.
		if c.backwardsFlowReporter != nil {
			c.backwardsFlowReporter(c.mu.lastPhysicalTime - t)
		}

		// time has moved backwards - tick using logic clock instead
		c.mu.lc++
		t = c.mu.lastPhysicalTime
	} else {
		// time is flowing in the right direction - reset the logical clock
		c.mu.lc = 0
		c.mu.lastPhysicalTime = t
	}

	return (t << 16) | c.mu.lc&logicalTimeMask
}

// PrometheusWallTimeMonotonicityReporter reports the number of times Tick() was called
// while the monotonicity of the wall tiime was violated.
func PrometheusWallTimeMonotonicityReporter(reg prometheus.Registerer) func(uint64) {
	gauge := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "wall_time_monotonicity_violation_total",
	})
	reg.MustRegister(gauge)

	return func(_ uint64) {
		gauge.Inc()
	}
}
