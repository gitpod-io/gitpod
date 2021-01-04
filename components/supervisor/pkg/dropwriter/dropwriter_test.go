// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dropwriter_test

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/supervisor/pkg/dropwriter"
)

func TestBucket(t *testing.T) {
	steps := func(dt time.Duration, c int) []time.Duration {
		res := make([]time.Duration, c)
		for i := range res {
			res[i] = dt
		}
		return res
	}
	constv := func(v int64, c int) []int64 {
		res := make([]int64, c)
		for i := range res {
			res[i] = v
		}
		return res
	}
	clock := func(dt []time.Duration) dropwriter.Clock {
		i := 0
		t := time.Time{}
		return func() time.Time {
			ot := t
			t = t.Add(dt[i])
			i++
			return ot
		}
	}

	tests := []struct {
		Name         string
		Bucket       *dropwriter.Bucket
		Reqs         []int64
		Expectations []int64
	}{
		{
			Name:         "below limit",
			Bucket:       dropwriter.NewBucketClock(20, 15, clock(steps(1300*time.Millisecond, 10))),
			Reqs:         constv(10, 10),
			Expectations: constv(10, 10),
		},
		{
			Name:         "above limit",
			Bucket:       dropwriter.NewBucketClock(1, 1, clock(steps(1300*time.Millisecond, 10))),
			Reqs:         constv(10, 10),
			Expectations: constv(1, 10),
		},
		{
			Name:         "upfront peak",
			Bucket:       dropwriter.NewBucketClock(20, 5, clock(steps(1300*time.Millisecond, 10))),
			Reqs:         append(constv(10, 1), constv(1, 9)...),
			Expectations: append(constv(10, 1), constv(1, 9)...),
		},
		{
			Name:         "mid peak",
			Bucket:       dropwriter.NewBucketClock(20, 5, clock(steps(1300*time.Millisecond, 10))),
			Reqs:         append(constv(1, 4), append(constv(30, 1), constv(1, 5)...)...),
			Expectations: append(constv(1, 4), append(constv(20, 1), constv(1, 5)...)...),
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			for step := range test.Reqs {
				grant := test.Bucket.TakeAvailable(test.Reqs[step])
				if grant != test.Expectations[step] {
					t.Errorf("step %d: did not receive expected tokens: requested %d, expected %d, received %d", step, test.Reqs[step], test.Expectations[step], grant)
				}
			}
		})
	}
}
