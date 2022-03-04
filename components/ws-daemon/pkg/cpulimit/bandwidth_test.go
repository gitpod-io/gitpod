// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cpulimit_test

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
	"github.com/google/go-cmp/cmp"
	"k8s.io/apimachinery/pkg/api/resource"
)

func TestBandwidthFromQuotaAndPeriod(t *testing.T) {
	tests := []struct {
		Name        string
		Period      time.Duration
		Quota       time.Duration
		Expectation cpulimit.Bandwidth
	}{
		{
			Name:        "0",
			Period:      0,
			Quota:       0,
			Expectation: 0,
		},
		{
			Name:        "mag10 period",
			Period:      100 * time.Millisecond,
			Quota:       500 * time.Millisecond,
			Expectation: 5000,
		},
		{
			Name:        "non mag10 period",
			Period:      250 * time.Millisecond,
			Quota:       1250 * time.Millisecond,
			Expectation: 5000,
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := cpulimit.BandwidthFromQuotaAndPeriod(test.Quota, test.Period)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestBandwidthFromQuantity(t *testing.T) {
	tests := []struct {
		Name        string
		Quantity    resource.Quantity
		Expectation cpulimit.Bandwidth
	}{
		{Name: "0", Quantity: resource.MustParse("0"), Expectation: 0},
		{Name: "full CPUs", Quantity: resource.MustParse("5"), Expectation: 5000},
		{Name: "milli CPUs", Quantity: resource.MustParse("500m"), Expectation: 500},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := cpulimit.BandwidthFromQuantity(test.Quantity)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestQuota(t *testing.T) {
	tests := []struct {
		Name        string
		Bandwidth   cpulimit.Bandwidth
		Period      time.Duration
		Expectation time.Duration
	}{
		{Name: "0", Bandwidth: 0, Period: 100 * time.Millisecond, Expectation: 0},
		{Name: "0 period", Bandwidth: 0, Period: 0 * time.Millisecond, Expectation: 0},
		{Name: "1 to 1ms", Bandwidth: 1, Period: 1 * time.Millisecond, Expectation: 1 * time.Microsecond},
		{Name: "1 to 100ms", Bandwidth: 1, Period: 100 * time.Millisecond, Expectation: 100 * time.Microsecond},
		{Name: "mag10", Bandwidth: 6000, Period: 100 * time.Millisecond, Expectation: 600 * time.Millisecond},
		{Name: "not mag10", Bandwidth: 6000, Period: 250 * time.Millisecond, Expectation: 1500 * time.Millisecond},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := test.Bandwidth.Quota(test.Period)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestIntegrate(t *testing.T) {
	tests := []struct {
		Name        string
		Bandwidth   cpulimit.Bandwidth
		DT          time.Duration
		Expectation cpulimit.CPUTime
	}{
		{Name: "0", Bandwidth: 0, DT: 1 * time.Second, Expectation: 0},
		{Name: "1 CPU second", Bandwidth: 1000, DT: 1 * time.Second, Expectation: cpulimit.CPUTime(1 * time.Second)},
		{Name: "1 CPU minute", Bandwidth: 6000, DT: 10 * time.Second, Expectation: cpulimit.CPUTime(1 * time.Minute)},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := test.Bandwidth.Integrate(test.DT)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
