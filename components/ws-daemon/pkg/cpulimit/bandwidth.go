// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cpulimit

import (
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/api/resource"
)

// Bandwidth represents the bandwidth of a CPU as milliseconds of CPU time per second.
// For example: 6000 CPU ms / second is the equivalent of 6 CPUs.
type Bandwidth uint64

// BandwidthFromQuotaAndPeriod converts quota and period (e.g. from Linux CFS bandwidth controller)
// to our own CPU bandwidth representation.
func BandwidthFromQuotaAndPeriod(quota, period time.Duration) Bandwidth {
	if period == 0 {
		return 0
	}

	// we divide on the micro/milli level rather than milli/seconds to avoid floating point math.
	res := quota.Microseconds() / period.Milliseconds()
	return Bandwidth(res)
}

// BandwidthFromQuantity converts a quantity to CPU bandwidth.
func BandwidthFromQuantity(v resource.Quantity) Bandwidth {
	return Bandwidth(v.MilliValue())
}

// BandwithFromUsage computes the bandwidth neccesary to realise actual CPU time
// consumption represented by two point samples.
func BandwithFromUsage(t0, t1 CPUTime, dt time.Duration) (Bandwidth, error) {
	if dt == 0 {
		return 0, nil
	}
	if t1 < t0 {
		return 0, fmt.Errorf("usage cannot be negative")
	}

	// we divide on the micro/milli level rather than milli/seconds to avoid floating point math.
	res := time.Duration(t1-t0).Microseconds() / dt.Milliseconds()
	return Bandwidth(res), nil
}

// Quota expresses the bandwidth as quota with respect to the period.
// This is useful when writing the quota of a CFS bandwidth controller.
func (b Bandwidth) Quota(period time.Duration) time.Duration {
	return time.Duration((time.Duration(b) * time.Millisecond).Microseconds() * period.Milliseconds())
}

// Integrate returns the total CPU time used if the bandwidth is exhausted
// for the given period of time.
func (b Bandwidth) Integrate(dt time.Duration) CPUTime {
	return CPUTime(time.Duration(b) * time.Microsecond * time.Duration(dt.Milliseconds()))
}

// CPUTime describes actual CPU time used
type CPUTime time.Duration
