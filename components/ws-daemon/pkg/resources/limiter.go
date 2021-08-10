// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package resources

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/prometheus/procfs"
)

// ResourceLimiter implements a strategy to limit the resurce use of a workspace
type ResourceLimiter interface {
	Limit(budgetLeft int64) (newLimit int64)
}

// FixedLimiter returns a fixed limit
func FixedLimiter(limit int64) ResourceLimiter {
	return fixedLimiter{limit}
}

type fixedLimiter struct {
	FixedLimit int64
}

func (f fixedLimiter) Limit(budgetLeft int64) int64 {
	return f.FixedLimit
}

// Bucket describes a "pot of CPU time" which can be spent at a particular rate.
type Bucket struct {
	Budget int64 `json:"budget"`
	Limit  int64 `json:"limit"`
}

// BucketLimiter limits CPU use based on different "pots of CPU time".
// The current limit is decided by the current bucket which is taken in order.
// For example:
//    buckets = [ { Budget: 50, Limit: 20 }, { Budget: 20, Limit: 10 }, { Budget: 0, Limit: 5 } ]
//    budgetSpent = totalBudget - budgetLeft == 65
//    then the current limit is 10, because we have spent all our budget from bucket 0, and are currently
//    spending from the second bucket.
// The last bucket's Budget is always ignored and becomes the default limit if all other
// buckets are used up.
// If the list of buckets is empty, this limiter limits to zero.
type BucketLimiter []Bucket

// Limit limits spending based on the budget that's left
func (buckets BucketLimiter) Limit(budgetSpent int64) (newLimit int64) {
	for i, bkt := range buckets {
		if i+1 == len(buckets) {
			// We've reached the last bucket - budget doesn't matter anymore
			return bkt.Limit
		}

		budgetSpent -= bkt.Budget
		if budgetSpent <= 0 {
			// BudgetSpent value is in this bucket, hence we have found our current bucket
			return bkt.Limit
		}
	}

	// empty bucket list
	return 0
}

// ClampingBucketLimiter is a stateful limiter that clamps the limit to the last bucket once that bucket is reached.
// Clamping happens until less budget has been used as permitted by that bucket.
type ClampingBucketLimiter struct {
	Buckets        []Bucket
	lastBucketLock bool
}

// Limit decides on a CPU use limit
func (bl *ClampingBucketLimiter) Limit(budgetSpent int64) (newLimit int64) {
	if bl.lastBucketLock {
		if budgetSpent < bl.Buckets[len(bl.Buckets)-1].Budget {
			bl.lastBucketLock = false
		}
	}
	if bl.lastBucketLock {
		return bl.Buckets[len(bl.Buckets)-1].Limit
	}

	for i, bkt := range bl.Buckets {
		if i+1 == len(bl.Buckets) {
			// We've reached the last bucket - budget doesn't matter anymore
			bl.lastBucketLock = true
			return bkt.Limit
		}

		budgetSpent -= bkt.Budget
		if budgetSpent <= 0 {
			// BudgetSpent value is in this bucket, hence we have found our current bucket
			return bkt.Limit
		}
	}

	// empty bucket list
	return 0
}

type BudgetedGlobalUseLimiterConfig struct {
	Default Bucket `json:"default"`
	Limited Bucket `json:"limited"`
	// SaturationThreshold is a saturation percentage between 0 and 100
	SaturationThreshold int `json:"saturationThreshold"`
	// DesaturationThreshold is the percentage at which we go back to the default bucket
	DesaturationThreshold int `json:"desaturationThreshold"`
}

type BudgetedGlobalUseLimiter struct {
	Config BudgetedGlobalUseLimiterConfig

	// Stat provides system-wide CPU use statistics
	Stat func() (load, idle float64, err error)
}

func defaultSystemStat() (func() (load, idle float64, err error), error) {
	proc, err := procfs.NewDefaultFS()
	if err != nil {
		return nil, err
	}

	return func() (load, idle float64, err error) {
		stat, err := proc.Stat()
		load = stat.CPUTotal.User + stat.CPUTotal.System
		idle = stat.CPUTotal.Idle
		return
	}, nil
}

// Limit decides on a CPU use limit
func (bl *BudgetedGlobalUseLimiter) Limit(budgetSpent int64) (newLimit int64) {
	defaultUsedUp := budgetSpent > bl.Config.Default.Budget

	load, idle, err := bl.Stat()
	if err != nil {
		log.WithError(err).Error("BudgetedGlobalUseLimiter: cannot stat CPU")
		return bl.Config.Default.Limit
	}
	saturation := (idle / (load + idle)) * 100
	if saturation > float64(bl.Config.SaturationThreshold) && defaultUsedUp {
		return bl.Config.Limited.Limit
	}

	return bl.Config.Default.Limit
}
