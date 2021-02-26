// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"encoding/json"
	"math/rand"
	"sort"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
)

// IngressPortAllocatorConfig holds the IngressPortAllocator config
type IngressPortAllocatorConfig struct {
	IngressRange        IngressPortRange `json:"ingressRange"`
	StateResyncInterval util.Duration    `json:"stateResyncInterval"`
}

// IngressPortRange defines the range of ingress ports the allocator can reign over
type IngressPortRange struct {
	Start int `json:"start"`
	End   int `json:"end"`
}

// IngressPortAllocator manages the mapping from workspace local ports to ingress ports which are allocated from a
// global pool of available ports.
type IngressPortAllocator interface {
	// UpdateAllocatedPorts takes the list of exposed workspaces ports, detects which have been removed/added since
	// the last call and frees/allocates the corresponding ingress ports. This makes it idempontent, e.g. calling it
	// with the same (sub) set of ports multiple times will always return the same list of ingress ports for that (sub) set.
	UpdateAllocatedPorts(metaID string, serviceName string, updatedPorts []int) (PortAllocation, error)

	// FreeAllocatedPorts frees all ports associated with the given service
	FreeAllocatedPorts(serviceName string)

	// Unmarshal unmarshals a per-service port allocation previously marshalled using its Marshal function
	Unmarshal(input []byte) (PortAllocation, error)

	// Stops all goroutines
	Stop()
}

// PortAllocation represents a per-service allocation of ports
type PortAllocation interface {
	// Serialize serializes the allocation s.t. it can be recovered using the port allocators
	// Unmarshal function.
	Marshal() ([]byte, error)

	// AllocatedPort returns the port allocated for a service's target port
	AllocatedPort(targetPort int) (allocatedPort int, ok bool)
}

// kubernetesBackedPortAllocator is a IngressPortAllocator which stores the state of the (ingressPort -> workspacePort)
// locally and is initialized from the kubernetes services where it is persisted as annotation
type kubernetesBackedPortAllocator struct {
	Config                   IngressPortAllocatorConfig
	WorkspacePortURLTemplate string
	GitpodHostURL            string

	clientset client.Client
	namespace string

	mu sync.RWMutex
	// maps a service to the list of AllocatedPorts
	services map[string]allocatedPorts
	// all allocated ports, indexed by ingress port
	allocatedPorts map[int]allocatedPort

	once     sync.Once
	stopChan chan struct{}
}

// allocatedPorts holds all AllocatedPorts for a service
type allocatedPorts map[int]allocatedPort

// AllocatedPort is a workspace port (either IDE or exposed) mapped to an allocated ingress port
type allocatedPort struct {
	// The workspace local port
	WorkspacePort int `json:"workspacePort"`
	// The port visible to the user (in the browser, e.g.)
	IngressPort int `json:"ingressPort,omitmpty"`
}

// NewIngressPortAllocator returns either:
//  a) an instance of ingressPortAllocatorImpl, or
//  b) an instance of dummyIngressPortAllocator,
// depending on whether or not the passed config is actuall present
func NewIngressPortAllocator(config *IngressPortAllocatorConfig, client client.Client, namespace string, wsPortURLTmpl string, gitpodHostURL string) (IngressPortAllocator, error) {
	if config == nil {
		return &noopIngressPortAllocator{}, nil
	}

	pa := &kubernetesBackedPortAllocator{
		Config:                   *config,
		WorkspacePortURLTemplate: wsPortURLTmpl,
		GitpodHostURL:            gitpodHostURL,

		clientset: client,
		namespace: namespace,

		services:       make(map[string]allocatedPorts),
		allocatedPorts: make(map[int]allocatedPort),

		stopChan: make(chan struct{}),
	}

	// run first init before we return the allocator to make sure queries are not answered with outdated (aka empty) state
	err := pa.reconciliateState()
	if err != nil {
		return nil, err
	}

	go pa.regularlyReconciliateState()

	return pa, nil
}

// run regularly syncs back the state persisted in the kubernetes service annotations into the local cache.
// Meant to be run as goroutine
func (pa *kubernetesBackedPortAllocator) regularlyReconciliateState() {
	tick := time.NewTicker(time.Duration(pa.Config.StateResyncInterval))
	defer tick.Stop()

	for {
		select {
		case <-pa.stopChan:
			return
		case <-tick.C:
		}

		err := pa.reconciliateState()
		if err != nil {
			log.WithError(err).Warnf("error while resyncing IngressPortAllocator state back from Kubernetes")
		}
	}
}

func (pa *kubernetesBackedPortAllocator) Stop() {
	pa.once.Do(func() { close(pa.stopChan) })
}

// reconciliateState loads the current port mappings from kubernetes service objects
func (pa *kubernetesBackedPortAllocator) reconciliateState() error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(pa.Config.StateResyncInterval))
	defer cancel()

	// read services and map to allocated ports
	var services corev1.ServiceList
	err := pa.clientset.List(ctx,
		&services,
		&client.ListOptions{
			Namespace: pa.namespace,
			LabelSelector: labels.SelectorFromSet(labels.Set{
				markerLabel: "true",
			}),
		},
	)
	if err != nil {
		return err
	}

	// re-initialize cache
	pa.mu.Lock()
	defer pa.mu.Unlock()

	pa.services = make(map[string]allocatedPorts)
	pa.allocatedPorts = make(map[int]allocatedPort)

	for _, svc := range services.Items {
		serialized := svc.Annotations[ingressPortsAnnotation]
		if serialized == "" {
			continue
		}
		alloc, err := pa.Unmarshal([]byte(serialized))
		if err != nil {
			// ignore error here and try others, too
			continue
		}

		aps, ok := alloc.(allocatedPorts)
		if !ok {
			return xerrors.Errorf("unmarshalled port allocations had the wrong type")
		}

		pa.services[svc.Name] = aps
		for _, ap := range aps {
			pa.allocatedPorts[ap.IngressPort] = ap
		}
	}
	return nil
}

// UpdateAllocatedPorts allocates all the given ports for the specified service
func (pa *kubernetesBackedPortAllocator) UpdateAllocatedPorts(metaID string, serviceName string, updatedPorts []int) (PortAllocation, error) {
	pa.mu.Lock()
	defer pa.mu.Unlock()

	// calc diff
	aps := pa.getAllocatedPorts(serviceName)
	var current []int
	for wsPort := range aps {
		current = append(current, wsPort)
	}
	removals, additions := diff(current, updatedPorts)

	// apply changes
	for _, removal := range removals {
		delete(aps, removal)
	}
	for _, addition := range additions {
		_, err := pa.allocatePort(metaID, serviceName, addition)
		if err != nil {
			return nil, err
		}
	}

	return aps, nil
}

func (pa *kubernetesBackedPortAllocator) allocatePort(metaID string, serviceName string, workspacePort int) (allocatedPort, error) {
	ingressPort, ok := pa.findNextIngressPort()
	if !ok {
		return allocatedPort{}, xerrors.Errorf("unable to allocate ingress port for %s:%d", serviceName, workspacePort)
	}

	aps := pa.getAllocatedPorts(serviceName)
	ap := allocatedPort{
		IngressPort:   ingressPort,
		WorkspacePort: workspacePort,
	}

	pa.allocatedPorts[ap.IngressPort] = ap
	aps[ap.WorkspacePort] = ap

	log.WithField("serviceName", serviceName).WithField("workspacePort", workspacePort).WithField("ingressPort", ap.IngressPort).Debug("mapping ingress port to workspace port")
	return ap, nil
}

// FreeAllocatedPorts frees all allocated ports for the given service
func (pa *kubernetesBackedPortAllocator) FreeAllocatedPorts(serviceName string) {
	pa.mu.Lock()
	defer pa.mu.Unlock()

	aps := pa.getAllocatedPorts(serviceName)
	if len(aps) == 0 {
		delete(pa.services, serviceName)
		return
	}

	for _, ap := range aps {
		delete(pa.allocatedPorts, ap.IngressPort)
	}
	delete(pa.services, serviceName)
}

func (pa *kubernetesBackedPortAllocator) Unmarshal(in []byte) (res PortAllocation, err error) {
	err = json.Unmarshal(in, &res)
	return
}

// getAllocatedPorts returns the AllocatedPorts for the given service. Expects callers to hold mu for locking.
func (pa *kubernetesBackedPortAllocator) getAllocatedPorts(serviceName string) allocatedPorts {
	aps, present := pa.services[serviceName]
	if !present {
		aps = make(allocatedPorts)
		pa.services[serviceName] = aps
	}
	return aps
}

// findNextIngressPort determines a new unallocated ingress port to allocate. Expects callers to hold mu for locking.
func (pa *kubernetesBackedPortAllocator) findNextIngressPort() (int, bool) {
	rng := pa.Config.IngressRange.End - pa.Config.IngressRange.Start
	// initial offset is random
	candidate := pa.Config.IngressRange.Start + rand.Intn(rng)

	for try := 1; try <= rng; try++ {
		_, alreadyAllocated := pa.allocatedPorts[candidate]
		if !alreadyAllocated {
			return candidate, true
		}

		// subsequent tries are successors
		candidate = ((candidate - pa.Config.IngressRange.Start + 1) % rng) + pa.Config.IngressRange.Start
	}

	return 0, false
}

// noopIngressPortAllocator is an empty implementation of IngressPortAllocator that does nothing
type noopIngressPortAllocator struct{}

func (d *noopIngressPortAllocator) UpdateAllocatedPorts(metaID string, serviceName string, updatedPorts []int) (PortAllocation, error) {
	return allocatedPorts(nil), nil
}
func (d *noopIngressPortAllocator) FreeAllocatedPorts(serviceName string) {}
func (d *noopIngressPortAllocator) Unmarshal(in []byte) (PortAllocation, error) {
	return allocatedPorts(nil), nil
}
func (d *noopIngressPortAllocator) Stop() {}

// Marshal serializes the allocates ports
func (aps allocatedPorts) Marshal() ([]byte, error) {
	if aps == nil {
		return nil, nil
	}

	return json.Marshal(aps)
}

func (aps allocatedPorts) AllocatedPort(port int) (allocatedPort int, ok bool) {
	p, ok := aps[port]
	if !ok {
		return 0, false
	}

	return p.IngressPort, true
}

// diff calculates the diff between a list of current ports and a new, incoming one
func diff(current []int, updated []int) (removals []int, additions []int) {
	sort.Ints(current)
	sort.Ints(updated)

	var ui int
	var ci int
	for ui < len(updated) && ci < len(current) {
		u := updated[ui]
		c := current[ci]

		if u > c {
			removals = append(removals, c)
			ci++
		} else if u < c {
			additions = append(additions, u)
			ui++
		} else if u == c {
			ui++
			ci++
		}
	}

	if ci < len(current) {
		removals = append(removals, current[ci:]...)
	}
	if ui < len(updated) {
		additions = append(additions, updated[ui:]...)
	}
	return removals, additions
}
