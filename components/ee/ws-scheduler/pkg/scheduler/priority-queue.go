// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	"sort"
	"sync"
	"time"

	metrics "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler/metrics"

	corev1 "k8s.io/api/core/v1"
)

type QueuedPodInfo struct {
	Pod *corev1.Pod
	// The time pod added to the scheduling queue.
	Timestamp time.Time
	// Number of schedule attempts before successfully scheduled.
	// It's used to record the # attempts metric.
	Attempts int
	// The time when the pod is added to the queue for the first time. The pod may be added
	// back to the queue multiple times before it's successfully scheduled.
	// It shouldn't be updated once initialized. It's used to record the e2e scheduling
	// latency for a pod.
	InitialAttemptTimestamp time.Time
}

func (pi *QueuedPodInfo) key() string {
	return key(pi.Pod)
}

func key(pod *corev1.Pod) string {
	return pod.Namespace + "/" + pod.Name
}

type LessFunc = func(item1, item2 *QueuedPodInfo) bool

type PriorityQueue struct {
	lessFunc       LessFunc
	initialBackoff time.Duration
	maximumBackoff time.Duration

	stop   chan struct{}
	closed bool

	lock *sync.RWMutex
	cond sync.Cond

	activeQueue    *podInfoQueue
	backoffPool    map[string]*QueuedPodInfo
	backoffMetrics metrics.MetricRecorder
}

func NewPriorityQueue(lessFunc LessFunc, initialBackoff time.Duration, maximumBackoff time.Duration) *PriorityQueue {
	lock := &sync.RWMutex{}
	return &PriorityQueue{
		lessFunc:       lessFunc,
		initialBackoff: initialBackoff,
		maximumBackoff: maximumBackoff,

		stop: make(chan struct{}),

		lock: lock,
		cond: *sync.NewCond(lock),

		activeQueue:    newPodInfoQueue(lessFunc, metrics.NewActivePodsRecorder()),
		backoffPool:    make(map[string]*QueuedPodInfo),
		backoffMetrics: metrics.NewBackoffPodsRecorder(),
	}
}

func (q *PriorityQueue) Run() {
	go func(q *PriorityQueue) {
		ticker := time.NewTicker(1 * time.Second)
		for {
			select {
			case <-ticker.C:
				q.moveCompletedBackoffToActive()
			case <-q.stop:
				return
			}
		}
	}(q)
}

func (q *PriorityQueue) Add(pod *corev1.Pod) {
	q.lock.Lock()
	defer q.lock.Unlock()

	pi := q.newQueuedPodInfo(pod)
	key := pi.key()
	if q.activeQueue.contains(key) {
		return
	}
	if _, exists := q.backoffPool[key]; exists {
		return
	}
	q.activeQueue.insert(pi)
	q.cond.Broadcast() // make sure pop gets notified
}

func (q *PriorityQueue) AddUnschedulable(pi *QueuedPodInfo) {
	q.lock.Lock()
	defer q.lock.Unlock()

	key := pi.key()
	if q.activeQueue.contains(key) {
		return
	}
	if _, exists := q.backoffPool[key]; exists {
		return
	}

	// refresh the timestamp since the pod is re-added.
	pi.Timestamp = time.Now()

	q.backoffPool[key] = pi
	q.backoffMetrics.Inc()
}

func (q *PriorityQueue) Delete(pod *corev1.Pod) bool {
	q.lock.Lock()
	defer q.lock.Unlock()

	key := key(pod)
	q.activeQueue.delete(key)
	return false
}

// Pop returns the QueuedPodInfo with the highest prio (blocking if none available)
func (q *PriorityQueue) Pop() (pi *QueuedPodInfo, wasClosed bool) {
	q.lock.Lock()
	defer q.lock.Unlock()

	for q.activeQueue.len() == 0 {
		if q.closed {
			return nil, true
		}
		q.cond.Wait()
	}

	pi = q.activeQueue.pop()
	pi.Attempts++
	return pi, false
}

func (q *PriorityQueue) MoveAllToActive(event string) {
	q.lock.Lock()
	defer q.lock.Unlock()

	for k, pi := range q.backoffPool {
		delete(q.backoffPool, k)
		q.backoffMetrics.Dec()
		q.activeQueue.insert(pi)
	}
	q.cond.Broadcast()
}

func (q *PriorityQueue) moveCompletedBackoffToActive() {
	q.lock.Lock()
	defer q.lock.Unlock()

	for k, pi := range q.backoffPool {
		backoffTime := q.getBackoffTime(pi)
		if backoffTime.After(time.Now()) {
			continue
		}
		delete(q.backoffPool, k)
		q.backoffMetrics.Dec()
		q.activeQueue.insert(pi)
	}
	q.cond.Broadcast()
}

func (q *PriorityQueue) Close() {
	q.lock.Lock()
	defer q.lock.Unlock()

	close(q.stop)
	q.closed = true
	q.cond.Broadcast()
}

func (p *PriorityQueue) newQueuedPodInfo(pod *corev1.Pod) *QueuedPodInfo {
	now := time.Now()
	return &QueuedPodInfo{
		Pod:                     pod,
		Timestamp:               now,
		InitialAttemptTimestamp: now,
	}
}

func (p *PriorityQueue) getBackoffTime(podInfo *QueuedPodInfo) time.Time {
	duration := p.calculateBackoffDuration(podInfo)
	backoffTime := podInfo.Timestamp.Add(duration)
	return backoffTime
}

func (p *PriorityQueue) calculateBackoffDuration(podInfo *QueuedPodInfo) time.Duration {
	duration := p.initialBackoff
	for i := 1; i < podInfo.Attempts; i++ {
		duration = duration * 2
		if duration > p.maximumBackoff {
			return p.maximumBackoff
		}
	}
	return duration
}

// podInfoQueue is a queue of QueuedPodInfo ordered by the given LessFunc.
// It is _not_ synchronized and relies on users to do this.
// This is _not_ optimized, and currently is:
//  - insert: O(n*log(n))
//  - delete: O(n*log(n))
//  - pop: O(1)
type podInfoQueue struct {
	lessFunc LessFunc
	// ordered list of keys, the last item is HEAD!
	queue []*item
	items map[string]*item

	metrics metrics.MetricRecorder
}

type item struct {
	key string
	pi  *QueuedPodInfo
	// the index into queue
	index int
}

func newPodInfoQueue(lessFunc LessFunc, metrics metrics.MetricRecorder) *podInfoQueue {
	return &podInfoQueue{
		lessFunc: lessFunc,
		queue:    make([]*item, 0),
		items:    make(map[string]*item, 0),
		metrics:  metrics,
	}
}

func (q *podInfoQueue) insert(pi *QueuedPodInfo) {
	item := &item{
		key:   pi.key(),
		pi:    pi,
		index: 0,
	}
	q.items[item.key] = item
	q.queue = append(q.queue, item)
	sort.Sort(sortItems{
		lessFunc: q.lessFunc,
		queue:    q.queue,
	})

	q.metrics.Inc()
}

func (q *podInfoQueue) pop() *QueuedPodInfo {
	len := len(q.queue)
	if len == 0 {
		return nil
	}
	item := q.queue[len-1]
	q.queue = q.queue[:len-1]
	delete(q.items, item.key)

	q.metrics.Dec()
	return item.pi
}

func (q *podInfoQueue) contains(key string) bool {
	_, exists := q.items[key]
	return exists
}

func (q *podInfoQueue) delete(key string) bool {
	item, exists := q.items[key]
	if !exists {
		return false
	}
	delete(q.items, key)

	// delete from queue and update indexes
	i := item.index
	q.queue = append(q.queue[:i], q.queue[i+1:]...)
	for ; i < len(q.queue); i++ {
		q.queue[i].index = i
	}

	q.metrics.Dec()
	return true
}

func (q *podInfoQueue) len() int {
	return len(q.queue)
}

type sortItems struct {
	lessFunc LessFunc
	queue    []*item
}

func (s sortItems) Len() int {
	return len(s.queue)
}
func (s sortItems) Less(i, j int) bool {
	return s.lessFunc(s.queue[i].pi, s.queue[j].pi)
}
func (s sortItems) Swap(i, j int) {
	s.queue[i], s.queue[j] = s.queue[j], s.queue[i]
	s.queue[i].index = i
	s.queue[j].index = j
}
