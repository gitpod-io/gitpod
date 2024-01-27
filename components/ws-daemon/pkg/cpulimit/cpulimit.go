// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cpulimit

import (
	"context"
	"sort"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/api/resource"
)

type Workspace struct {
	ID string

	NrThrottled uint64
	Usage       CPUTime
	QoS         int
	Annotations map[string]string
}

type WorkspaceHistory struct {
	ID string

	LastUpdate  *Workspace
	UsageT0     CPUTime
	ThrottleLag uint64
	Limit       Bandwidth
}

func (h *WorkspaceHistory) Usage() CPUTime {
	if h == nil || h.LastUpdate == nil {
		return 0
	}
	return h.LastUpdate.Usage - h.UsageT0
}

func (h *WorkspaceHistory) Update(w Workspace) {
	if h.LastUpdate == nil {
		h.UsageT0 = w.Usage
	} else {
		h.ThrottleLag = h.LastUpdate.NrThrottled
	}
	h.LastUpdate = &w
}

func (h *WorkspaceHistory) Throttled() bool {
	if h.LastUpdate == nil || h.ThrottleLag == 0 {
		return false
	}

	return h.ThrottleLag != h.LastUpdate.NrThrottled
}

type DistributorSource func(context.Context) ([]Workspace, error)
type DistributorSink func(id string, limit Bandwidth, burst bool)

func NewDistributor(source DistributorSource, sink DistributorSink, limiter ResourceLimiter, burstLimiter ResourceLimiter, totalBandwidth Bandwidth) *Distributor {
	return &Distributor{
		Source:         source,
		Sink:           sink,
		Limiter:        limiter,
		BurstLimiter:   burstLimiter,
		TotalBandwidth: totalBandwidth,
		History:        make(map[string]*WorkspaceHistory),
	}
}

type Distributor struct {
	Source DistributorSource
	Sink   DistributorSink

	History      map[string]*WorkspaceHistory
	Limiter      ResourceLimiter
	BurstLimiter ResourceLimiter

	// TotalBandwidth is the total CPU time available in nanoseconds per second
	TotalBandwidth Bandwidth
	LastTickUsage  CPUTime

	// Log is used (if not nil) to log out errors. If log is nil, no logging happens.
	Log *logrus.Entry
}

type DistributorDebug struct {
	BandwidthAvail, BandwidthUsed, BandwidthBurst Bandwidth
}

// Run starts a ticker which repeatedly calls Tick until the context is canceled.
// This function does not return until the context is canceled.
func (d *Distributor) Run(ctx context.Context, dt time.Duration) {
	t := time.NewTicker(dt)
	defer t.Stop()

	go func() {
		for range t.C {
			_, err := d.Tick(dt)
			if err != nil && d.Log != nil {
				d.Log.WithError(err).Warn("cannot advance CPU limit distributor")
			}
		}
	}()
	<-ctx.Done()
}

// Tick drives the distributor and pushes out new limits.
// Callers are epxected to call this function repeatedly, with dt time inbetween calls.
func (d *Distributor) Tick(dt time.Duration) (DistributorDebug, error) {
	// update state
	ws, err := d.Source(context.Background())
	if err != nil {
		return DistributorDebug{}, err
	}

	f := make(map[string]struct{}, len(ws))
	for _, w := range ws {
		h, ok := d.History[w.ID]
		if !ok {
			h = &WorkspaceHistory{
				ID: w.ID,
			}
			d.History[w.ID] = h
		}
		h.Update(w)
		f[w.ID] = struct{}{}
	}
	for oldWS := range d.History {
		if _, found := f[oldWS]; !found {
			delete(d.History, oldWS)
		}
	}

	var totalUsage CPUTime
	wsOrder := make([]string, 0, len(d.History))
	for id, h := range d.History {
		wsOrder = append(wsOrder, id)
		totalUsage += h.Usage()
	}

	// We order workspaces by their QoS class first. Within the same class we order
	// by usage: lowest usage -> highest priority
	sort.Slice(wsOrder, func(i, j int) bool {
		uI := d.History[wsOrder[i]].Usage()
		uJ := d.History[wsOrder[j]].Usage()
		qI := d.History[wsOrder[i]].LastUpdate.QoS
		qJ := d.History[wsOrder[j]].LastUpdate.QoS
		if qI == qJ {
			return uI < uJ
		}
		return qI < qJ
	})

	if d.LastTickUsage == 0 {
		d.LastTickUsage = totalUsage
		return DistributorDebug{
			BandwidthAvail: d.TotalBandwidth,
			BandwidthUsed:  0,
		}, nil
	}

	totalBandwidth, err := BandwithFromUsage(d.LastTickUsage, totalUsage, dt)
	d.LastTickUsage = totalUsage
	if err != nil {
		return DistributorDebug{
			BandwidthAvail: d.TotalBandwidth,
			BandwidthUsed:  0,
		}, err
	}

	// enforce limits
	var burstBandwidth Bandwidth
	for _, id := range wsOrder {
		ws := d.History[id]
		limit, err := d.Limiter.Limit(ws)
		if err != nil {
			log.WithError(err).Errorf("unable to apply min limit")
			continue
		}

		// if we didn't get the max bandwidth, but were throttled last time
		// and there's still some bandwidth left to give, let's act as if had
		// never spent any CPU time and assume the workspace will spend their
		// entire bandwidth at once.
		var burst bool
		if totalBandwidth < d.TotalBandwidth && ws.Throttled() {
			limit, err = d.BurstLimiter.Limit(ws)
			if err != nil {
				log.WithError(err).Errorf("unable to apply burst limit")
				continue
			}

			// We assume the workspace is going to use as much as their limit allows.
			// This might not be true, because their process which consumed so much CPU
			// may have ended by now.
			totalBandwidth += limit

			burstBandwidth += limit
		}

		d.Sink(id, limit, burst)
	}

	return DistributorDebug{
		BandwidthAvail: d.TotalBandwidth,
		BandwidthUsed:  totalBandwidth,
		BandwidthBurst: burstBandwidth,
	}, nil
}

func (d *Distributor) Reset() {
	d.History = make(map[string]*WorkspaceHistory)
}

// ResourceLimiter implements a strategy to limit the resurce use of a workspace
type ResourceLimiter interface {
	Limit(wsh *WorkspaceHistory) (Bandwidth, error)
}

var _ ResourceLimiter = (*fixedLimiter)(nil)
var _ ResourceLimiter = (*annotationLimiter)(nil)
var _ ResourceLimiter = (*BucketLimiter)(nil)
var _ ResourceLimiter = (*ClampingBucketLimiter)(nil)
var _ ResourceLimiter = (*compositeLimiter)(nil)

// FixedLimiter returns a fixed limit
func FixedLimiter(limit Bandwidth) ResourceLimiter {
	return fixedLimiter{limit}
}

type fixedLimiter struct {
	FixedLimit Bandwidth
}

func (f fixedLimiter) Limit(wsh *WorkspaceHistory) (Bandwidth, error) {
	return f.FixedLimit, nil
}

func AnnotationLimiter(annotation string) ResourceLimiter {
	return annotationLimiter{
		Annotation: annotation,
	}
}

type annotationLimiter struct {
	Annotation string
}

func (a annotationLimiter) Limit(wsh *WorkspaceHistory) (Bandwidth, error) {
	value, ok := wsh.LastUpdate.Annotations[a.Annotation]
	if !ok {
		return 0, xerrors.Errorf("no annotation named %s found on workspace %s", a.Annotation, wsh.ID)
	}

	limit, err := resource.ParseQuantity(value)
	if err != nil {
		return 0, xerrors.Errorf("failed to parse %s for workspace %s", limit, wsh.ID)
	}

	return BandwidthFromQuantity(limit), nil
}

// Bucket describes a "pot of CPU time" which can be spent at a particular rate.
type Bucket struct {
	Budget CPUTime   `json:"budget"`
	Limit  Bandwidth `json:"limit"`
}

// BucketLimiter limits CPU use based on different "pots of CPU time".
// The current limit is decided by the current bucket which is taken in order.
// For example:
//
//	buckets = [ { Budget: 50, Limit: 20 }, { Budget: 20, Limit: 10 }, { Budget: 0, Limit: 5 } ]
//	budgetSpent = totalBudget - budgetLeft == 65
//	then the current limit is 10, because we have spent all our budget from bucket 0, and are currently
//	spending from the second bucket.
//
// The last bucket's Budget is always ignored and becomes the default limit if all other
// buckets are used up.
// If the list of buckets is empty, this limiter limits to zero.
type BucketLimiter []Bucket

// Limit limits spending based on the budget that's left
func (buckets BucketLimiter) Limit(wsh *WorkspaceHistory) (Bandwidth, error) {
	budgetSpent := wsh.Usage()

	for i, bkt := range buckets {
		if i+1 == len(buckets) {
			// We've reached the last bucket - budget doesn't matter anymore
			return bkt.Limit, nil
		}

		budgetSpent -= bkt.Budget
		if budgetSpent <= 0 {
			// BudgetSpent value is in this bucket, hence we have found our current bucket
			return bkt.Limit, nil
		}
	}

	// empty bucket list
	return 0, nil
}

// ClampingBucketLimiter is a stateful limiter that clamps the limit to the last bucket once that bucket is reached.
// Clamping happens until less budget has been used as permitted by that bucket.
type ClampingBucketLimiter struct {
	Buckets        []Bucket
	lastBucketLock bool
}

// Limit decides on a CPU use limit
func (bl *ClampingBucketLimiter) Limit(wsh *WorkspaceHistory) (Bandwidth, error) {
	budgetSpent := wsh.Usage()

	if bl.lastBucketLock {
		if budgetSpent < bl.Buckets[len(bl.Buckets)-1].Budget {
			bl.lastBucketLock = false
		}
	}
	if bl.lastBucketLock {
		return bl.Buckets[len(bl.Buckets)-1].Limit, nil
	}

	for i, bkt := range bl.Buckets {
		if i+1 == len(bl.Buckets) {
			// We've reached the last bucket - budget doesn't matter anymore
			bl.lastBucketLock = true
			return bkt.Limit, nil
		}

		budgetSpent -= bkt.Budget
		if budgetSpent <= 0 {
			// BudgetSpent value is in this bucket, hence we have found our current bucket
			return bkt.Limit, nil
		}
	}

	// empty bucket list
	return 0, nil
}

type compositeLimiter struct {
	limiters []ResourceLimiter
}

func CompositeLimiter(limiters ...ResourceLimiter) ResourceLimiter {
	return &compositeLimiter{
		limiters: limiters,
	}
}

func (cl *compositeLimiter) Limit(wsh *WorkspaceHistory) (Bandwidth, error) {
	var errs []error
	for _, limiter := range cl.limiters {
		limit, err := limiter.Limit(wsh)
		if err != nil {
			errs = append(errs, err)
			continue
		}

		return limit, nil
	}

	allerr := make([]string, len(errs))
	for i, err := range errs {
		allerr[i] = err.Error()
	}
	return 0, xerrors.Errorf("no limiter was able to provide a limit", strings.Join(allerr, ", "))
}

type CFSController interface {
	// Usage returns the cpuacct.usage value of the cgroup
	Usage() (usage CPUTime, err error)
	// SetQuota sets a new CFS quota on the cgroup
	SetLimit(limit Bandwidth) (changed bool, err error)
	// NrThrottled returns the number of CFS periods the cgroup was throttled
	NrThrottled() (uint64, error)
}
