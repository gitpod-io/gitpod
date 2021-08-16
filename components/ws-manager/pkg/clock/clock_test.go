// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package clock

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestTick(t *testing.T) {
	type Expectation struct {
		Samples                []uint64
		Panic                  interface{}
		MonotonicityViolations int
	}

	const logicalClockSize = 0xFFFF
	tests := []struct {
		Name        string
		Ticks       int
		PT          []uint64
		Expectation Expectation
	}{
		{
			Name:        "monotonous physical time",
			Ticks:       3,
			PT:          []uint64{1, 2, 3},
			Expectation: Expectation{Samples: []uint64{65536, 131072, 196608}},
		},
		{
			Name:  "physical time freeze",
			Ticks: 3,
			PT:    []uint64{1, 1, 2},
			Expectation: Expectation{
				Samples:                []uint64{65536, 65537, 131072},
				MonotonicityViolations: 1,
			},
		},
		{
			Name:  "physical time going backwards",
			Ticks: 5,
			PT:    []uint64{1, 2, 1, 2, 5},
			Expectation: Expectation{
				Samples:                []uint64{65536, 131072, 131073, 131074, 327680},
				MonotonicityViolations: 2,
			},
		},
		{
			Name:  "logical time overflow",
			Ticks: logicalClockSize + 10,
			PT: func() []uint64 {
				r := make([]uint64, logicalClockSize+10)
				for i := range r {
					r[i] = 1
				}
				return r
			}(),
			Expectation: Expectation{
				Samples: func() []uint64 {
					r := make([]uint64, logicalClockSize+1)
					for i := range r {
						r[i] = uint64(65535 + i + 1)
					}
					return r
				}(),
				MonotonicityViolations: 65535,
				Panic:                  "logical clock overflow",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			if len(test.PT) != test.Ticks {
				t.Fatalf("%d ticks require %d physical time samples", test.Ticks, test.Ticks)
				return
			}

			var o int
			clock := &HLC{
				physicalTime: func() uint64 {
					v := test.PT[o]
					o++
					return v
				},
			}

			var act Expectation
			clock.ReportBackwardsTime(func(diff uint64) {
				act.MonotonicityViolations++
			})

			func() {
				defer func() {
					act.Panic = recover()
				}()
				for i := 0; i < test.Ticks; i++ {
					act.Samples = append(act.Samples, clock.Tick())
				}
			}()
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected tick (-want +got):\n%s", diff)
			}
		})
	}
}
