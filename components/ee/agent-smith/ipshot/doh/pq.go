// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package doh

import (
	"net"
)

type Item struct {
	Name        string
	Type        uint16
	Addresses   []net.IP
	DomainIndex uint16
	Expiry      int

	index int // The index of the item in the heap (mandated by the heap.Interface methods)
}

// A PriorityQueue implements heap.Interface and holds Item entities.
type PriorityQueue []*Item

func (pq PriorityQueue) Len() int {
	return len(pq)
}

func (pq PriorityQueue) Less(i, j int) bool {
	// We want to pop by the lowest expiration.
	// The lower the expiry, the higher the priority.
	return pq[i].Expiry < pq[j].Expiry
}

func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].index = i
	pq[j].index = j
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil // Avoid memory leak
	*pq = old[0 : n-1]
	return item
}

// update modifies the priority and values of an Item in the queue.
// func (pq *PriorityQueue) update(item *Item, priority int, name string, addresses []string) {
// 	item.Name = name
// 	item.Addresses = addresses
// 	item.Expiry = priority
// 	heap.Fix(pq, item.index)
// }

func (pq *PriorityQueue) Push(x interface{}) {
	n := len(*pq)
	item := x.(*Item)
	item.index = n
	*pq = append(*pq, item)
}
