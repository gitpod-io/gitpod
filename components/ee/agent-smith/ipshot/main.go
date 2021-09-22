// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"container/heap"
	"fmt"
	"net"
	"os"
	"os/signal"
	"sort"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/ipshot/doh"
	ipshotnet "github.com/gitpod-io/gitpod/agent-smith/ipshot/net"
	"github.com/gitpod-io/gitpod/agent-smith/ipshot/store"
	"github.com/gitpod-io/gitpod/agent-smith/ipshot/tc"
	"github.com/miekg/dns"
	"github.com/sirupsen/logrus"
)

var log = logrus.New()

func init() {
	log.SetLevel(logrus.DebugLevel)
}

func main() {
	quit := make(chan bool)

	signalChan := make(chan os.Signal)
	signal.Notify(signalChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-signalChan
		log.Info("quitting in 1 sec")
		quit <- true
		time.Sleep(time.Second)
		os.Exit(1)
	}()

	// todo > enter the correct net ns

	// Get the default gateway
	route, err := ipshotnet.DiscoverDefaultGateway()
	if err != nil {
		log.WithError(err).Fatal("could not discover default gateway")
	}
	log.WithField("network interface", route.Iface).Info("default gateway")

	// Load the SHED_CLS eBPF program for TC
	// TODO(cw): defer the removal of the QDISK CLSACT which will also unload the TC BPF program
	if err := tc.Load("bpf/tc.bpf.o", route.Iface, log); err != nil {
		log.WithError(err).Fatalf("loading eBPF filter")
	}

	// Setup the eBPF map storage
	// Note: requires the BPF FS to be mounted (if it's not present, it can be mounted using `mount`, should be present but might need to mounted in the container)
	m, err := store.Attach("/sys/fs/bpf/tc/globals/hot", true /* remove existing items */)
	if err != nil {
		log.WithError(err).Fatal("loading the storage")
	}

	pq := make(doh.PriorityQueue, 0)
	count4 := 0
	ttls := []int{}

	p := doh.NewPool(len(doh.Questions), doh.GetUpstream)
	// First run: lookup all the questions we have...
	for i, q := range doh.Questions {
		// IPv4
		addresses4, minTTL4, err := doh.Lookup(p, q, dns.TypeA, true)
		if err != nil {
			log.WithError(err).Fatal("fail")
		}

		// todo > IPv6
		// addresses6, minTTL6, err := Lookup(p, q, dns.TypeAAAA)

		if len(addresses4) != 0 {
			heap.Push(&pq, &doh.Item{
				Name:        q,
				Type:        dns.TypeA,
				Addresses:   addresses4,
				Expiry:      minTTL4,
				DomainIndex: uint16(i + 1),
				Index:       count4,
			})
			// Upsert IPv4 addresses
			// key (IPv4, as uint32) <-> value (1 + domain/question index, as uint16)
			num, err := store.UpsertV4(m, addresses4, uint16(i+1))
			if err != nil {
				log.WithError(err).WithField("protocol", "IPv4").Info("storing IPs")
			}
			log.WithField("count", num).WithField("protocol", "IPv4").Info("storing IPs")
			ttls = append(ttls, minTTL4)
			count4++
		} // todo > else, what?
	}

	// Beware: DON'T TRUST the TTL of the domains

	// Continue to lookup...
	maxLookupsPerTick := 2
	tickBuffer := time.Millisecond * 100
	tickInterval := doh.Timeout * time.Duration(maxLookupsPerTick)
	secs := int(tickInterval / time.Second)
	tick := time.NewTicker(tickInterval + tickBuffer)
	tickCount := 0
	for {
		select {
		case <-tick.C:
			tickCount++
			fmt.Println("")
			log.WithField("seconds", tickInterval).Info("ticking")
			items := []*doh.Item{}
			// Pop by expiration
			numLookupsPerTick := 0
			for pq.Len() > 0 {
				item := heap.Pop(&pq).(*doh.Item)
				item.Expiry -= secs
				if item.Expiry <= 0 {
					// Lookup expired item only if we have not already reached the maximum number of lookups during this tick
					if numLookupsPerTick < maxLookupsPerTick {
						addresses, minTTL, _ := doh.Lookup(p, item.Name, item.Type, false /* do not retry lookup */)
						if len(addresses) != 0 {
							diff := difference(addresses, item.Addresses)
							if len(diff) == 0 && len(addresses) == len(item.Addresses) {
								m := median(ttls...)
								log.WithField("median", m).WithField("ttl", minTTL).Info("no new IPs after lookup")
								// Euristic: push this item in the second part of the priority queue
								item.Expiry = max(minTTL, m)
							} else {
								// Delete previous IPv4 addresses
								// todo > IPv6
								numDeleted, err := store.DeleteV4(m, item.Addresses)
								if err != nil {
									log.WithError(err).WithField("protocol", "IPv4").Info("deleting IPs")
									// todo > retry? store for later attempt?
								}
								log.WithField("count", numDeleted).WithField("protocol", "IPv4").Info("deleting IPs")
								// Update item with the new addresses
								item.Addresses = addresses
								item.Expiry = minTTL
								// Upsert the new IPv4 addresses
								// todo > IPv6
								numStoring, err := store.UpsertV4(m, addresses, item.DomainIndex)
								if err != nil {
									log.WithError(err).WithField("protocol", "IPv4").Info("storing IPs")
								}
								log.WithField("count", numStoring).WithField("protocol", "IPv4").Info("storing IPs")
							}
						} // todo > else, what?
						numLookupsPerTick++
					} else {
						// Max lookups per tick reached
						// Go ahead: item gets pushed back to the priority queue
						log.WithField("count", numLookupsPerTick).Warn("maximum number of lookups per tick")
					}
				}
				// Store to push them back later
				items = append(items, item)
				log.WithField("name", item.Name).
					WithField("ttl", item.Expiry).
					Info("updating expiration")
			}

			// Push updates
			ttls = []int{}
			for _, item := range items {
				ttls = append(ttls, item.Expiry) // todo > add back +(tickCount*secs) ??
				heap.Push(&pq, item)
			}
		case <-quit:
			tick.Stop()
		}
	}
}

// Returns the IPs in` a` that are not in `b`.
func difference(a, b []net.IP) []net.IP {
	mb := make(map[string]struct{}, len(b))
	for _, x := range b {
		mb[x.String()] = struct{}{}
	}
	var diff []net.IP
	for _, x := range a {
		if _, found := mb[x.String()]; !found {
			diff = append(diff, x)
		}
	}
	return diff
}

func median(n ...int) int {
	sort.Ints(n)
	l := len(n)
	if l%2 == 0 {
		return (n[l/2-1] + n[l/2]) / 2
	}
	return n[l/2]
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
