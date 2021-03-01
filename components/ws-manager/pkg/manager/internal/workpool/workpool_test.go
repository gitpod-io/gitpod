// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workpool_test

import (
	"fmt"
	"math/rand"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/watch"

	"github.com/gitpod-io/gitpod/ws-manager/pkg/manager/internal/workpool"
)

// This thing is notoriously hard to test due to the inherent concurrency, and this test is just a best effort attempt.
// Still, testing this is a game of probability and basically like rolling a dice. The more often we try the more likely
// we are to find bugs.
const defaultRepeats = 200

type QOT struct {
	Queue string
	Order int
	Time  int64
}

func TestEventWorkerPool(t *testing.T) {
	repeats := defaultRepeats
	if testing.Short() {
		repeats = 1
	}
	for i := 0; i < repeats; i++ {
		// We start a few produces who concurrently produce events and stuff it into the pool. The pool workers in turn stuff
		// a token of their work into a channel (with enough space so as to not block). Produces and workers have random delays
		// so that they "interfere" with each other.
		// Once everything is said and done, we use the worker's tokens to verify everything was correct.
		// Great care has to be taken in this test code to not accidentially trip the race detector.
		producers := []struct {
			Items    int
			MaxDelay time.Duration
		}{
			{10, 10 * time.Microsecond},
			{10, 15 * time.Microsecond},
			{10, 5 * time.Microsecond},
			{10, 50 * time.Microsecond},
		}

		expectedItemCount := 0
		expectedTime := 0 * time.Second
		for _, p := range producers {
			expectedItemCount += p.Items
			expectedTime += p.MaxDelay
		}
		result := make(chan string, expectedItemCount)

		pool := workpool.NewEventWorkerPool(func(evt watch.Event) {
			item := string(evt.Type + ";->")
			result <- item

			maxDelay := 20 * time.Millisecond
			delay := time.Duration(rand.Int63n(maxDelay.Nanoseconds()))
			<-time.After(delay)
		})
		pool.Start(uint(len(producers) - 1))

		start := make(chan struct{})
		var wg sync.WaitGroup
		producer := func(name string, items int, delay time.Duration) {
			<-start
			for i := 0; i < items; i++ {
				evt := fmt.Sprintf("%s;%d;%d", name, i, time.Now().UnixNano())
				pool.Add(name, watch.Event{Type: watch.EventType(evt)})

				<-time.After(time.Duration(rand.Int63n(delay.Nanoseconds())))
			}
			wg.Done()
		}

		for i, p := range producers {
			go producer(fmt.Sprintf("p%d", i), p.Items, p.MaxDelay)
		}
		wg.Add(len(producers))

		close(start)
		wg.Wait()

		done := make(chan []QOT)
		go func() {
			workedItems := make([]QOT, 0)
			for r := range result {
				qot := strings.Split(r, ";")
				order, _ := strconv.Atoi(qot[1])
				time, _ := strconv.ParseInt(qot[2], 10, 64)
				workedItems = append(workedItems, QOT{qot[0], order, time})
			}
			done <- workedItems
		}()

		// wait for everything to finish
		<-time.After(2 * expectedTime)
		pool.Stop()
		close(result)

		workedItems := <-done
		if len(workedItems) != expectedItemCount {
			t.Errorf("worked on incorrect number of items (%d instead of %d)", len(workedItems), expectedItemCount)
		}

		if !runWasMixed(t, workedItems) {
			return
		}

		checkForCorrectOrder(t, workedItems)
		checkForSingleExecution(t, workedItems)
	}
}

// For this test to be valid we have to ensure it was actually mixed properly.
func runWasMixed(t *testing.T, quots []QOT) (cont bool) {
	lq := ""
	queuesWereMixed := false
	for _, w := range quots {
		if lq > w.Queue {
			queuesWereMixed = true
			break
		}
		lq = w.Queue
	}
	if !queuesWereMixed {
		t.Skip("queues were not mixed")
		return false
	}

	lo := 0
	orderWasMixed := false
	for _, w := range quots {
		if lo > w.Order {
			orderWasMixed = true
			break
		}
		lo = w.Order
	}
	if !orderWasMixed {
		t.Skip("event order was not mixed")
		return false
	}

	return true
}

func checkForCorrectOrder(t *testing.T, quots []QOT) {
	// note: the Order field in the QOT is the source order, but not the order in which
	//       the workers have worked on the items. We must ensure the time on the quots
	//       is monontonous, w.r.t. to the (source) order.
	orders := make(map[string][]QOT)
	for _, q := range quots {
		l, ok := orders[q.Queue]
		if !ok {
			l = make([]QOT, 0)
		}

		l = append(l, q)
		orders[q.Queue] = l
	}

	for _, orderedQot := range orders {
		sort.Slice(orderedQot, func(i, j int) bool { return orderedQot[i].Time < orderedQot[j].Time })

		var lt int64
		var lq *QOT
		for _, qot := range orderedQot {
			if lt > qot.Time {
				t.Errorf("work order is wrong: %v came before %v", qot, lq)
			}
			lt = qot.Time
			lq = &qot
		}
	}
}

func checkForSingleExecution(t *testing.T, qots []QOT) {
	index := make(map[string]struct{})
	for _, q := range qots {
		// don't add the execution time to the key - the work item is identified by its queue and source order
		key := fmt.Sprintf("%s:%d", q.Queue, q.Order)
		if _, exists := index[key]; exists {
			t.Errorf("work item was executed multiple times: %v", q)
		}
		index[key] = struct{}{}
	}
}

// TestEventWorkerPoolNotBlocking tests if the handling of one queue can block that of another
func TestEventWorkerPoolNotBlocking(t *testing.T) {
	for i := 0; i < defaultRepeats; i++ {
		// Idea: with two workers enqueue eventA, enqueue eventB and wait for eventB to finish.
		//       eventB will signal it's finished to eventA. If this does not finish within 1 second, we locked up because
		//       eventB did not start.
		start := make(chan struct{})
		workingOnA := make(chan struct{})
		workingOnB := make(chan struct{})
		workDone := make(chan struct{})

		var pool *workpool.EventWorkerPool
		go func() {
			<-start
			pool.Add("a", watch.Event{Type: watch.EventType("eventA")})
			<-workingOnA
			pool.Add("b", watch.Event{Type: watch.EventType("eventB")})
		}()

		pool = workpool.NewEventWorkerPool(func(evt watch.Event) {
			if evt.Type == "eventA" {
				workingOnA <- struct{}{}
				<-workingOnB
				workDone <- struct{}{}
			} else if evt.Type == "eventB" {
				workingOnB <- struct{}{}
			}
		})
		pool.Start(2)
		defer pool.Stop()

		start <- struct{}{}
		select {
		case <-workDone:
		// we're good
		case <-time.After(1 * time.Second):
			t.Errorf("eventB did never run")
		}
	}
}
