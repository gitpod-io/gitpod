// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	"fmt"
	"sort"
	"strings"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"

	corev1 "k8s.io/api/core/v1"
	res "k8s.io/apimachinery/pkg/api/resource"
)

// State holds all nodes
type State struct {
	Nodes    map[string]*Node
	Pods     map[string]*corev1.Pod
	Bindings []*Binding
}

// Node models a k8s node
type Node struct {
	Node   *corev1.Node
	Pods   []*corev1.Pod
	Ghosts []*corev1.Pod

	RAM              ResourceUsage
	EphemeralStorage ResourceUsage

	Services map[string]struct{}

	// The number of pods on a node is limited by the resources available and by the kubelet.
	PodSlots struct {
		// Total number of pod slots on this node.
		Total int64

		// Available pod slots
		Available int64
	}
}

// Binding models a k8s binding pod -> node
type Binding struct {
	Pod      *corev1.Pod
	NodeName string
}

// ResourceUsage models various quantities of a resource on a given node
type ResourceUsage struct {
	// Total quantity of resource available on this machine, used or not.
	Total *res.Quantity

	// Quantity avialable/free on the node in total.
	// This figure is: total - (headlessWorkspaces + regularWorkspaces + allOtherPods)
	Available *res.Quantity

	// Resource used by all headless workspaces
	UsedHeadless *res.Quantity

	// Resource used by all regular workspaces
	UsedRegular *res.Quantity

	// Resource used by non-workspace pods
	UsedOther *res.Quantity
}

func newResourceUsage(total *res.Quantity) ResourceUsage {
	tc := total.DeepCopy()
	return ResourceUsage{
		Total:        &tc,
		Available:    res.NewQuantity(0, res.BinarySI),
		UsedHeadless: res.NewQuantity(0, res.BinarySI),
		UsedOther:    res.NewQuantity(0, res.BinarySI),
		UsedRegular:  res.NewQuantity(0, res.BinarySI),
	}
}

func (r *ResourceUsage) updateAvailable() {
	tc := r.Total.DeepCopy()
	r.Available = &tc
	r.Available.Sub(*r.UsedHeadless)
	r.Available.Sub(*r.UsedOther)
	r.Available.Sub(*r.UsedRegular)
}

// ComputeState builds a new state based on the current world view
func ComputeState(nodes []*corev1.Node, pods []*corev1.Pod, bindings []*Binding, ramSafetyBuffer *res.Quantity, ghostsAreInvisible bool) *State {
	type podAndNode struct {
		pod      *corev1.Pod
		nodeName string
	}
	var (
		nds       = make(map[string]*Node)
		pds       = make(map[string]*corev1.Pod)
		podToNode = make(map[string]*podAndNode)
	)

	// We need a unique assignment of pod to node, as no pod can be scheduled on two nodes
	// at the same time. Also, we assume that our bindings are more accurate/up to date than
	// the pods, hence given them precedence when it comes to computing this assignment.
	for _, p := range pods {
		pds[p.Name] = p

		if p.Spec.NodeName == "" {
			continue
		}
		podToNode[p.Name] = &podAndNode{
			pod:      p,
			nodeName: p.Spec.NodeName,
		}
	}
	for _, b := range bindings {
		if _, exists := pds[b.Pod.Name]; !exists {
			// We've found a binding for a pod that we don't yet see in the list of pods.
			// This can happen if we're listing faster than the Pod informer updates.
			pds[b.Pod.Name] = b.Pod
		}

		podToNode[b.Pod.Name] = &podAndNode{
			pod:      b.Pod,
			nodeName: b.NodeName,
		}
	}

	// With a unique pod to node assignment, we can invert that relationship and compute
	// which node has which pods. If we did this right away, we might assign the same pod
	// to multiple nodes.
	type ntp struct {
		pods   map[string]struct{}
		ghosts map[string]struct{}
	}
	nodeToPod := make(map[string]*ntp, len(nodes))
	for _, n := range nodes {
		nds[n.Name] = &Node{
			Node:     n,
			Services: make(map[string]struct{}),
		}
		nodeToPod[n.Name] = &ntp{
			pods:   make(map[string]struct{}),
			ghosts: make(map[string]struct{}),
		}
	}
	for podName, podAndNode := range podToNode {
		ntp, ok := nodeToPod[podAndNode.nodeName]
		if !ok {
			continue
		}
		if isGhostWorkspace(podAndNode.pod) {
			ntp.ghosts[podName] = struct{}{}
			if !ghostsAreInvisible {
				ntp.pods[podName] = struct{}{}
			}
		} else {
			ntp.pods[podName] = struct{}{}
		}
	}

	for nodeName, node := range nds {
		node.PodSlots.Total = node.Node.Status.Capacity.Pods().Value()
		node.PodSlots.Available = node.PodSlots.Total

		ntp := nodeToPod[nodeName]
		assignedPods := ntp.pods
		allocatableRAMWithSafetyBuffer := node.Node.Status.Allocatable.Memory().DeepCopy()
		allocatableRAMWithSafetyBuffer.Sub(*ramSafetyBuffer)
		node.RAM = newResourceUsage(&allocatableRAMWithSafetyBuffer)
		node.EphemeralStorage = newResourceUsage(node.Node.Status.Allocatable.StorageEphemeral())
		node.Pods = make([]*corev1.Pod, 0, len(assignedPods))
		for pn := range assignedPods {
			pod := pds[pn]
			node.Pods = append(node.Pods, pds[pn])
			node.PodSlots.Available--

			service, ok := pod.ObjectMeta.Labels[wsk8s.GitpodNodeServiceLabel]
			if ok {
				var ready bool
				for _, c := range pod.Status.Conditions {
					if c.Type != corev1.ContainersReady {
						continue
					}
					ready = c.Status == corev1.ConditionTrue
					break
				}
				if !ready {
					continue
				}
				node.Services[service] = struct{}{}
			}

			var ram, eph *res.Quantity
			if isHeadlessWorkspace(pod) {
				ram = node.RAM.UsedHeadless
				eph = node.EphemeralStorage.UsedHeadless
			} else if isWorkspace(pod) {
				ram = node.RAM.UsedRegular
				eph = node.EphemeralStorage.UsedRegular
			} else {
				ram = node.RAM.UsedOther
				eph = node.EphemeralStorage.UsedOther
			}
			ram.Add(podRAMRequest(pod))
			eph.Add(podEphemeralStorageRequest(pod))
		}
		node.RAM.updateAvailable()
		node.EphemeralStorage.updateAvailable()

		node.Ghosts = make([]*corev1.Pod, 0, len(ntp.ghosts))
		for gn := range ntp.ghosts {
			node.Ghosts = append(node.Ghosts, pds[gn])
		}
	}

	return &State{
		Nodes:    nds,
		Pods:     pds,
		Bindings: bindings,
	}
}

// FilterNodes removes all nodes for which the predicate does not return true
func (s *State) FilterNodes(predicate func(*Node) (include bool)) {
	var goner []string
	for k, n := range s.Nodes {
		if predicate(n) {
			continue
		}
		goner = append(goner, k)
	}

	for _, k := range goner {
		delete(s.Nodes, k)
	}
}

// SortOrder configures the order in which something is sorted
type SortOrder int

const (
	// SortAsc means things are sorted in ascending order
	SortAsc SortOrder = iota
	// SortDesc means things are sorted in descending order
	SortDesc
)

// SortNodesByUsedRegularWorkspaceRAM sorts the node list of this state by the amount of RAM used
// by regular workspaces on each node.
func (s *State) SortNodesByUsedRegularWorkspaceRAM(order SortOrder) []*Node {
	nodes := NodeMapToList(s.Nodes)
	sort.Slice(nodes, func(i, j int) bool {
		ni, nj := nodes[i], nodes[j]
		if order == SortAsc {
			ni, nj = nodes[j], nodes[i]
		}

		cmp := ni.RAM.UsedRegular.AsDec().Cmp(nj.RAM.UsedRegular.AsDec())
		if cmp == 0 {
			if ni.Node.Name < nj.Node.Name {
				cmp = 1
			} else {
				cmp = -1
			}
		}
		return cmp > 0
	})
	return nodes
}

// SortNodesByAvailableRAM returns the list of nodes from state sorted by .RAM.Available
func (s *State) SortNodesByAvailableRAM(order SortOrder) []*Node {
	nodes := NodeMapToList(s.Nodes)
	sort.Slice(nodes, func(i, j int) bool {
		if order == SortAsc {
			return nodes[i].RAM.Available.AsDec().Cmp(nodes[j].RAM.Available.AsDec()) <= 0
		}

		return nodes[i].RAM.Available.AsDec().Cmp(nodes[j].RAM.Available.AsDec()) > 0
	})
	return nodes
}

// FindOldestGhostOnNode returns the name of the oldest ghost on the node with the given node, or "" if there is no
// node or ghost
func (s *State) FindOldestGhostOnNode(nodeName string) string {
	node, ok := s.Nodes[nodeName]
	if !ok {
		return ""
	}

	if len(node.Ghosts) == 0 {
		return ""
	} else if len(node.Ghosts) == 1 {
		return node.Ghosts[0].Name
	}

	ghosts := make([]*corev1.Pod, 0, len(node.Ghosts))
	for _, g := range node.Ghosts {
		ghosts = append(ghosts, g)
	}
	sort.Slice(ghosts, func(i, j int) bool {
		return ghosts[i].ObjectMeta.CreationTimestamp.Time.Before(ghosts[j].ObjectMeta.CreationTimestamp.Time)
	})
	return ghosts[0].Name
}

// podRAMRequest calculates the amount of RAM requested by all containers of the given pod
func podRAMRequest(pod *corev1.Pod) res.Quantity {
	requestedRAM := res.NewQuantity(0, res.BinarySI)
	for _, c := range pod.Spec.Containers {
		requestedRAM.Add(*c.Resources.Requests.Memory())
	}
	return *requestedRAM
}

// podEphemeralStorageRequest calculates the amount of ephemeral storage requested by all containers of the given pod
func podEphemeralStorageRequest(pod *corev1.Pod) res.Quantity {
	requestedEphStorage := res.NewQuantity(0, res.BinarySI)
	for _, c := range pod.Spec.Containers {
		requestedEphStorage.Add(*c.Resources.Requests.StorageEphemeral())
	}
	return *requestedEphStorage
}

// NodeMapToList returns a slice of entry of the map
func NodeMapToList(m map[string]*Node) []*Node {
	nodes := make([]*Node, 0, len(m))
	for _, n := range m {
		nodes = append(nodes, n)
	}
	return nodes
}

// DebugStringResourceUsage returns a debug string describing the used resources
func (r *ResourceUsage) DebugStringResourceUsage() string {
	usedRegularGibs := toMiString(r.UsedRegular)
	usedHeadlessGibs := toMiString(r.UsedHeadless)
	usedOtherGibs := toMiString(r.UsedOther)
	totalGibs := toMiString(r.Total)
	availableGibs := toMiString(r.Available)

	return fmt.Sprintf("used %s+%s+%s of %s, avail %s Mi", usedRegularGibs, usedHeadlessGibs, usedOtherGibs, totalGibs, availableGibs)
}

func toMiString(q *res.Quantity) string {
	cv, _ := q.AsScale(res.Mega) // we don't care about sub-meg precision because it is for displaying only
	var out []byte
	out, _ = cv.AsCanonicalBytes(out) // we already know the exponent as we set scale above
	return string(out)
}

// DebugStringNodes prints available RAM per node as string for debug purposes
func DebugStringNodes(nodes ...*Node) string {
	lines := make([]string, 0, len(nodes)*3)
	for _, node := range nodes {
		lines = append(lines, fmt.Sprintf("- %s:", node.Node.Name))
		lines = append(lines, fmt.Sprintf("  RAM: %s", node.RAM.DebugStringResourceUsage()))
		lines = append(lines, fmt.Sprintf("  Eph. Storage: %s", node.EphemeralStorage.DebugStringResourceUsage()))
	}
	return strings.Join(lines, "\n")
}
