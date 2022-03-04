// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workpool

import (
	"sync"

	"k8s.io/apimachinery/pkg/watch"
)

// EventWorkerPool lets us work on events concurrently with the following guarantees:
//  1. Each event is handled exactly once
//  2. Each event is handled in order with respect to its "queueID", e.g. for the sequence
//     qa:e1 qb:e1 qa:e2 qa:e3 qb:e2 we guarantee that the qa events are handled in order
//     and the qb are handled in order.
//  3. One queue does not block another. E.g. if handling an event on one queue does not block
//     the event handling on another.
//  4. No allocations and no leaks, meaning that manage virtual queues based on their IDs alone.
//     One does not have to expliictely tear down a queue, becaues there's no memory that gets
//     allocated in the first place.
//
// How does it work?
// Each work item is associated with a queue identifed by a unique name. When a work item gets added
// to the pool, it is placed inside a journal and we notify the worker go routines. The workers check
// if there's some work in the journal whose queue is free at the moment. Otherwise they go back to waiting.
// When a queue is freed (because the work on it was done), the workers wake up as well.
//
// Why not use kubernetes/client-go/workqueue?
// We have different requirements than the workqueue. The Kubernetes workqueue cares about the order/
// execution of single items. We care about the order of several items grouped by some factor.
//
type EventWorkerPool struct {
	WorkOn func(watch.Event)

	stop chan struct{}
	wg   sync.WaitGroup

	incoming chan struct{}
	queueSet map[string]struct{}
	journal  []*eventWorkerPoolItem
	mu       sync.Mutex
}

// NewEventWorkerPool creates a new worker pool for handling events
func NewEventWorkerPool(workOn func(watch.Event)) *EventWorkerPool {
	return &EventWorkerPool{
		WorkOn: workOn,

		stop:     make(chan struct{}),
		incoming: make(chan struct{}),

		queueSet: make(map[string]struct{}),
		journal:  make([]*eventWorkerPoolItem, 0),
	}
}

type eventWorkerPoolItem struct {
	Queue string
	Evt   watch.Event
	State eventWorkerPoolItemState
}

type eventWorkerPoolItemState int

const (
	eventWorkerPoolItemUntouched = 0
	eventWorkerPoolItemWorking   = 1
	eventWorkerPoolItemDone      = 2
)

// Start starts the worker pool with a number of workers
func (p *EventWorkerPool) Start(workers uint) {
	for i := uint(0); i < workers; i++ {
		go p.workUntilStopped(int(i))
	}
}

// Add adds a new work item to this pool
func (p *EventWorkerPool) Add(queue string, evt watch.Event) {
	p.mu.Lock()
	p.journal = append(p.journal, &eventWorkerPoolItem{queue, evt, eventWorkerPoolItemUntouched})
	p.mu.Unlock()

	p.incoming <- struct{}{}
}

// Stop stops this worker pool and all its operations. This function waits for the workers
// to actually stop working.
func (p *EventWorkerPool) Stop() {
	close(p.stop)
	p.wg.Wait()
}

// untilStopped repeatedly calls work until work returns true
func (p *EventWorkerPool) workUntilStopped(idx int) {
	p.wg.Add(1)
	for !p.work(idx) {
	}
	p.wg.Done()
}

func (p *EventWorkerPool) work(idx int) (stopped bool) {
	// We always try work first. Only if there's no work do we start waiting.
	p.mu.Lock()
	for i, item := range p.journal {
		// We skip any queue that we're already working on. This ensures guarantee 2, because
		// we hold a read lock on mu and any modification of the queueSet is guarded by a mu write lock.
		// Thus the queueSet cannot change as we loop.
		if _, inUse := p.queueSet[item.Queue]; inUse {
			continue
		}

		// We have found an item in the journal which we think we can work on. Let's get a write lock
		// and start working. To work on this item so we must  claim the queue, mark the item as in
		// work and remove the item from the journal, and release the lock.
		p.queueSet[item.Queue] = struct{}{}
		item.State = eventWorkerPoolItemWorking
		p.journal = append(p.journal[:i], p.journal[i+1:]...)
		p.mu.Unlock()

		// now that we hold the queue for this item we can start working on it
		p.WorkOn(item.Evt)

		// we're done working on this item - release the queue
		p.mu.Lock()
		item.State = eventWorkerPoolItemDone
		delete(p.queueSet, item.Queue)
		p.mu.Unlock()

		// we have just freed up a queue - maybe someone in the journal was waiting for it
		// (don't block on this notification). If we don't wake anyone, workers will pick up
		// the work in their next round.
		select {
		case p.incoming <- struct{}{}:
		default:
		}

		// because we've given up our locks as this point we must start over
		return
	}

	// if we've made it here either the journal was empty or we couldn't start working
	// on any of its items. Let's see if there's something else to do.
	p.mu.Unlock()

	// Wait for the condition to give us work
	select {
	case <-p.stop:
		return true
	case <-p.incoming:
		// we have something to do - let's do it in the next round
	}

	return
}
