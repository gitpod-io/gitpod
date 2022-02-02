// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cpulimit_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"math/rand"
	"os"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/ws-daemon/pkg/cpulimit"
)

const (
	totalCapacity   = cpulimit.Bandwidth(12000)
	testSampleCount = 1000
	testDt          = 10 * time.Second
	testDuration    = testSampleCount * testDt
)

var (
	defaultLimit         = cpulimit.FixedLimiter(2000)
	defaultBreakoutLimit = cpulimit.FixedLimiter(6000)
)

// Consumer consumes CPU time
type Consumer interface {
	ID() string
	Rate(t time.Duration) cpulimit.Bandwidth
	QoS() int
}

// SteadyConsumer consumes constant CPU time
type SteadyConsumer struct {
	id   string
	rate cpulimit.Bandwidth
	qos  int
}

func (s SteadyConsumer) ID() string                              { return s.id }
func (s SteadyConsumer) Rate(t time.Duration) cpulimit.Bandwidth { return s.rate }
func (s SteadyConsumer) QoS() int                                { return s.qos }

// SinusoidalConsumer consumes sinusoidal shaped CPU time
type SinusoidalConsumer struct {
	id     string
	phase  time.Duration
	period time.Duration
	ampl   cpulimit.Bandwidth
	qos    int
}

func (s SinusoidalConsumer) ID() string { return s.id }
func (s SinusoidalConsumer) Rate(t time.Duration) cpulimit.Bandwidth {
	pt := (t - s.phase).Seconds()
	pr := math.Pi / s.period.Seconds()
	ampl := float64(s.ampl)
	return cpulimit.Bandwidth(ampl*math.Sin(pt*pr) + ampl)
}
func (s SinusoidalConsumer) QoS() int { return s.qos }

// SpikyConsumer randomly spikes its CPU use
type SpikyConsumer struct {
	Consumer

	MinSpike, MaxSpike cpulimit.Bandwidth
	LikelyHood         float64
	MinLatch, MaxLatch time.Duration

	latch      time.Duration
	latchedVal cpulimit.Bandwidth
}

func (s *SpikyConsumer) Rate(t time.Duration) cpulimit.Bandwidth {
	if t < s.latch {
		return s.latchedVal
	}
	if rand.Float64() < s.LikelyHood {
		s.latch = t + s.MinLatch + time.Duration(rand.Int63n(int64(s.MaxLatch-s.MinLatch)))
		s.latchedVal = s.MinSpike + cpulimit.Bandwidth(rand.Int63n(int64(s.MaxSpike-s.MinSpike)))
		return s.latchedVal
	}
	return s.Consumer.Rate(t)
}

type RecordedConsumer struct {
	Id  string               `json:"id"`
	Qos int                  `json:"qos"`
	T   []time.Duration      `json:"times"`
	R   []cpulimit.Bandwidth `json:"rates"`
}

func (s RecordedConsumer) ID() string { return s.Id }
func (s RecordedConsumer) Rate(t time.Duration) cpulimit.Bandwidth {
	var idx int
	for idx = 0; idx < len(s.T) && s.T[idx] < t; idx++ {
	}
	if idx > 0 {
		idx--
	}
	return s.R[idx]
}
func (s RecordedConsumer) QoS() int { return s.Qos }

func RecordConsumer(consumer Consumer, dt, totalT time.Duration) *RecordedConsumer {
	var res RecordedConsumer
	res.Id = consumer.ID()
	res.Qos = consumer.QoS()
	for t := 0 * time.Second; t < totalT; t += dt {
		res.T = append(res.T, t)
		res.R = append(res.R, consumer.Rate(t))
	}
	return &res
}

// NewNode produces a new virtual machine
func NewNode(c ...Consumer) *Node {
	return &Node{
		Consumer:                  c,
		State:                     make(map[string]*consumerState, len(c)),
		ClampOnAvailableBandwidth: true,
	}
}

// Node repsents a single node in a cluster
type Node struct {
	Consumer []Consumer
	State    map[string]*consumerState

	ClampOnAvailableBandwidth bool
	bandwidthReq              cpulimit.Bandwidth
	bandwidthUsed             cpulimit.Bandwidth
}

type consumerState struct {
	Consumer  Consumer
	Limit     cpulimit.Bandwidth
	Usage     cpulimit.CPUTime
	Throttled uint64
}

// Tick ticks time
func (n *Node) Tick(totalT, dt time.Duration) {
	var (
		bw      = make(map[string]cpulimit.Bandwidth, len(n.Consumer))
		thr     = make(map[string]bool, len(n.Consumer))
		totalBW cpulimit.Bandwidth
	)
	for _, c := range n.Consumer {
		state, ok := n.State[c.ID()]
		if !ok {
			state = &consumerState{Consumer: c}
			n.State[c.ID()] = state
		}

		// apply limit
		bandwidth := c.Rate(totalT)
		if state.Limit != 0 && bandwidth > state.Limit {
			bandwidth = state.Limit
			thr[c.ID()] = true
		}

		bw[c.ID()] = bandwidth
		totalBW += bandwidth
	}

	n.bandwidthReq = totalBW
	if n.ClampOnAvailableBandwidth && totalBW > totalCapacity {
		// if we've overbooked, we subtract an equal amount from everyone
		for i := 0; i < 100; i++ {
			if totalBW <= totalCapacity {
				break
			}

			overbook := totalBW - totalCapacity
			sub := overbook/cpulimit.Bandwidth(len(n.Consumer)) + 1
			for id := range bw {
				if bw[id] < sub {
					totalBW -= bw[id]
					bw[id] = 0
				} else {
					totalBW -= sub
					bw[id] -= sub
				}
				thr[id] = true
			}
		}
	}
	n.bandwidthUsed = totalBW

	// consume bandwidth and update throttled status
	for id := range bw {
		state := n.State[id]
		state.Usage += bw[id].Integrate(dt)
		if thr[id] {
			state.Throttled++
		}
	}
}

// Source acts as source to a distributor
func (n *Node) Source(context.Context) ([]cpulimit.Workspace, error) {
	var res []cpulimit.Workspace
	for id, w := range n.State {
		res = append(res, cpulimit.Workspace{
			ID:          id,
			NrThrottled: w.Throttled,
			Usage:       w.Usage,
			QoS:         w.Consumer.QoS(),
		})
	}
	return res, nil
}

// Sink acts as sink for a distributor
func (n *Node) Sink(id string, limit cpulimit.Bandwidth) {
	n.State[id].Limit = limit
}

func (n *Node) DumpHeader(out io.Writer) {
	fmt.Fprintf(out, "t,id,desiredrate,throttled,usage,limit,actualrate,bwavail,bwused,bwreq,bwbreak\n")
}

// Dump dumps the internal state
func (n *Node) Dump(out io.Writer, t time.Duration, dbg cpulimit.DistributorDebug) {
	for _, c := range n.Consumer {
		actualRate := c.Rate(t)
		state := n.State[c.ID()]
		limit := state.Limit
		if actualRate > limit {
			actualRate = limit
		}
		fmt.Fprintf(out, "%d,%s,%d,%d,%d,%d,%d,%d,%d,%d,%d\n", t, c.ID(), c.Rate(t), state.Throttled, time.Duration(state.Usage).Milliseconds(), state.Limit, actualRate, totalCapacity, n.bandwidthUsed, n.bandwidthReq, dbg.BandwidthBreakout)
	}
}

func TestBucketLimitsEatAll(t *testing.T) {
	node := NewNode(
		SteadyConsumer{id: "q1", rate: 6000, qos: -1},
		SteadyConsumer{id: "q2", rate: 4000, qos: -1},
		SteadyConsumer{id: "a1", rate: 5000},
		SteadyConsumer{id: "a2", rate: 3000},
		SteadyConsumer{id: "a3", rate: 2000},
		SteadyConsumer{id: "a4", rate: 1000},
	)
	dist := cpulimit.NewDistributor(node.Source, node.Sink, defaultLimit, defaultBreakoutLimit, totalCapacity)
	runSimulation(t, node, dist)
}

func TestBucketLimitsSine(t *testing.T) {
	node := NewNode(
		SteadyConsumer{id: "q1", rate: 5000, qos: -1},
		SteadyConsumer{id: "a2", rate: 3000},
		SteadyConsumer{id: "a3", rate: 2000},
		SteadyConsumer{id: "a4", rate: 1000},
		SinusoidalConsumer{
			id:     "s1",
			phase:  0,
			period: 15 * time.Minute,
			ampl:   5000,
		},
	)
	dist := cpulimit.NewDistributor(node.Source, node.Sink, defaultLimit, defaultBreakoutLimit, totalCapacity)
	runSimulation(t, node, dist)
}

func TestBucketLimitsMiner(t *testing.T) {
	cs := defaultConsumerSet(t)
	cs = append(cs, SteadyConsumer{id: "miner01", rate: 10000})
	node := NewNode(cs...)

	dist := cpulimit.NewDistributor(node.Source, node.Sink, defaultLimit, defaultBreakoutLimit, totalCapacity)

	runSimulation(t, node, dist)
}

func TestBucketLimitsMixedQoS(t *testing.T) {
	cs := defaultConsumerSet(t)
	cs = cs[5:]
	cs = append(cs, defaultQoSConsumerSet(t)...)
	node := NewNode(cs...)

	dist := cpulimit.NewDistributor(node.Source, node.Sink, defaultLimit, defaultBreakoutLimit, totalCapacity)

	runSimulation(t, node, dist)
}

func TestBucketLimitsMaxConsumer(t *testing.T) {
	var cs []Consumer
	for i := 0; i < 20; i++ {
		cs = append(cs,
			SteadyConsumer{id: fmt.Sprintf("c%02d", i), rate: 10000},
		)
	}
	node := NewNode(cs...)
	dist := cpulimit.NewDistributor(node.Source, node.Sink, defaultLimit, defaultBreakoutLimit, totalCapacity)

	runSimulation(t, node, dist)
}

func TestBucketLimitsNewProdBehaviour(t *testing.T) {
	cs := defaultConsumerSet(t)
	node := NewNode(cs...)

	dist := cpulimit.NewDistributor(node.Source, node.Sink, defaultLimit, defaultBreakoutLimit, totalCapacity)

	runSimulation(t, node, dist)
}

func TestProdBehaviour(t *testing.T) {
	node := NewNode(defaultConsumerSet(t)...)
	limiter := cpulimit.BucketLimiter{
		cpulimit.Bucket{Budget: 5 * 60 * 6000, Limit: 6000},
		cpulimit.Bucket{Budget: 5 * 60 * 4000, Limit: 4000},
		cpulimit.Bucket{Budget: 5 * 60 * 2000, Limit: 2000},
	}
	breakoutLimiter := limiter
	dist := cpulimit.NewDistributor(node.Source, node.Sink, limiter, breakoutLimiter, totalCapacity)

	runSimulation(t, node, dist)
}

func runSimulation(t *testing.T, node *Node, dist *cpulimit.Distributor) {
	f, err := os.OpenFile(fmt.Sprintf("sim_%s.csv", t.Name()), os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0744)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	node.DumpHeader(f)

	totalT := 0 * time.Second
	for i := 0; i < testSampleCount; i++ {
		node.Tick(totalT, testDt)
		dbg, _ := dist.Tick(testDt)
		node.Dump(f, totalT, dbg)
		totalT += testDt
	}
}

func defaultConsumerSet(t *testing.T) []Consumer {
	const fn = "default-consumer.json"
	var res []Consumer
	for i := 0; i < 15; i++ {
		c := &SpikyConsumer{
			Consumer:   SteadyConsumer{id: fmt.Sprintf("c%02d", i), rate: 200},
			MaxSpike:   6000,
			MinSpike:   3000,
			LikelyHood: 0.01,
			MinLatch:   10 * time.Second,
			MaxLatch:   5 * time.Minute,
		}
		res = append(res, c)
	}
	return generateOrRestoreConsumers(t, fn, res)
}

func defaultQoSConsumerSet(t *testing.T) []Consumer {
	const fn = "default-qos-consumer.json"
	var res []Consumer
	for i := 0; i < 5; i++ {
		c := &SpikyConsumer{
			Consumer:   SteadyConsumer{id: fmt.Sprintf("q%02d", i), rate: 200, qos: -1},
			MaxSpike:   6000,
			MinSpike:   4000,
			LikelyHood: 0.05,
			MinLatch:   10 * time.Second,
			MaxLatch:   5 * time.Minute,
		}
		res = append(res, c)
	}
	return generateOrRestoreConsumers(t, fn, res)
}

func generateOrRestoreConsumers(t *testing.T, fn string, cs []Consumer) []Consumer {
	fc, err := os.ReadFile(fn)
	if os.IsNotExist(err) {
		var (
			rcs []*RecordedConsumer
			res []Consumer
		)

		for _, c := range cs {
			rc := RecordConsumer(c, testDt, testDuration)
			rcs = append(rcs, rc)
			res = append(res, rc)
		}
		fc, _ := json.Marshal(rcs)
		err = ioutil.WriteFile(fn, fc, 0644)
		if err != nil {
			t.Fatal(err)
		}
		return res
	}
	if err != nil {
		t.Fatal(err)
	}

	var rcs []*RecordedConsumer
	err = json.Unmarshal(fc, &rcs)
	if err != nil {
		t.Fatal(err)
	}

	res := make([]Consumer, len(rcs))
	for i := range rcs {
		res[i] = rcs[i]
	}

	return res
}
