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
	Node *corev1.Node
	// contains all pods that are not in Ghosts
	Pods []*corev1.Pod
	// contains all ghost workspaces from our namespace
	Ghosts []*corev1.Pod

	RAM              ResourceUsage
	EphemeralStorage ResourceUsage

	Services map[string]struct{}

	// The number of pods on a node is limited by the resources available and by the kubelet.
	PodSlots PodSlots
}

type PodSlots struct {
	// Total number of pod slots on this node.
	Total int64

	// Available pod slots
	Available int64
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

	// Resource used by ghost workspaces
	UsedGhost *res.Quantity

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
		UsedGhost:    res.NewQuantity(0, res.BinarySI),
		UsedHeadless: res.NewQuantity(0, res.BinarySI),
		UsedOther:    res.NewQuantity(0, res.BinarySI),
		UsedRegular:  res.NewQuantity(0, res.BinarySI),
	}
}

func (r *ResourceUsage) updateAvailable(ghostsAreVisible bool) {
	tc := r.Total.DeepCopy()
	r.Available = &tc
	if ghostsAreVisible {
		r.Available.Sub(*r.UsedGhost)
	}
	r.Available.Sub(*r.UsedHeadless)
	r.Available.Sub(*r.UsedOther)
	r.Available.Sub(*r.UsedRegular)
}

func (r *ResourceUsage) DeepCopy() *ResourceUsage {
	copy := func(qty *res.Quantity) *res.Quantity {
		cpy := qty.DeepCopy()
		return &cpy
	}
	return &ResourceUsage{
		Total:        copy(r.Total),
		Available:    copy(r.Available),
		UsedGhost:    copy(r.UsedGhost),
		UsedHeadless: copy(r.UsedHeadless),
		UsedOther:    copy(r.UsedOther),
		UsedRegular:  copy(r.UsedRegular),
	}
}

func (n *Node) copy() *Node {
	return &Node{
		Node:             n.Node,
		Pods:             n.Pods,
		Ghosts:           n.Ghosts,
		Services:         n.Services,
		RAM:              *n.RAM.DeepCopy(),
		EphemeralStorage: *n.EphemeralStorage.DeepCopy(),
		PodSlots: PodSlots{
			Total:     n.PodSlots.Total,
			Available: n.PodSlots.Available,
		},
	}
}

// ComputeState builds a new state based on the current world view
func ComputeState(nodes []*corev1.Node, pods []*corev1.Pod, bindings []*Binding, ramSafetyBuffer *res.Quantity, ghostsAreVisible bool, namespace string) *State {
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
		pods map[string]struct{}
	}
	nodeToPod := make(map[string]*ntp, len(nodes))
	for _, n := range nodes {
		nds[n.Name] = &Node{
			Node: n,
		}
		nodeToPod[n.Name] = &ntp{
			pods: make(map[string]struct{}),
		}
	}
	for podName, podAndNode := range podToNode {
		ntp, ok := nodeToPod[podAndNode.nodeName]
		if !ok {
			continue
		}
		ntp.pods[podName] = struct{}{}
	}

	for nodeName, node := range nds {
		ntp := nodeToPod[nodeName]
		assignedPods := ntp.pods
		node.Pods = make([]*corev1.Pod, 0, len(assignedPods))
		node.Ghosts = make([]*corev1.Pod, 0, len(assignedPods))
		for pn := range assignedPods {
			pod := pds[pn]
			if isGhostWorkspace(pod, namespace) {
				node.Ghosts = append(node.Ghosts, pod)
			} else {
				node.Pods = append(node.Pods, pod)
			}
		}
		node.update(namespace, ramSafetyBuffer, ghostsAreVisible)
	}

	return &State{
		Nodes:    nds,
		Pods:     pds,
		Bindings: bindings,
	}
}

func (n *Node) update(namespace string, ramSafetyBuffer *res.Quantity, ghostsAreVisible bool) {
	n.PodSlots.Total = n.Node.Status.Capacity.Pods().Value()
	n.PodSlots.Available = n.PodSlots.Total
	allocatableRAMWithSafetyBuffer := n.Node.Status.Allocatable.Memory().DeepCopy()
	allocatableRAMWithSafetyBuffer.Sub(*ramSafetyBuffer)
	n.RAM = newResourceUsage(&allocatableRAMWithSafetyBuffer)
	n.EphemeralStorage = newResourceUsage(n.Node.Status.Allocatable.StorageEphemeral())
	n.Services = make(map[string]struct{})

	var assignedPods []*corev1.Pod
	assignedPods = append(assignedPods, n.Pods...)
	assignedPods = append(assignedPods, n.Ghosts...)
	for _, pod := range assignedPods {
		n.PodSlots.Available--

		service, ok := pod.ObjectMeta.Labels[wsk8s.GitpodNodeServiceLabel]
		if ok {
			var (
				containersReady bool
				podReady        bool
				podRunning      bool
			)
			for _, c := range pod.Status.Conditions {
				if c.Type == corev1.ContainersReady {
					containersReady = c.Status == corev1.ConditionTrue
				}
				if c.Type == corev1.PodReady {
					podReady = c.Status == corev1.ConditionTrue
				}
			}
			podRunning = pod.Status.Phase == corev1.PodRunning

			// we're checking podReady AND containersReady to be sure we're not missing sth
			if !(podReady && containersReady && podRunning) {
				continue
			}
			n.Services[service] = struct{}{}
		}

		var ram, eph *res.Quantity
		if isGhostWorkspace(pod, namespace) {
			ram = n.RAM.UsedGhost
			eph = n.EphemeralStorage.UsedGhost
		} else if wsk8s.IsHeadlessWorkspace(pod) {
			ram = n.RAM.UsedHeadless
			eph = n.EphemeralStorage.UsedHeadless
		} else if wsk8s.IsRegularWorkspace(pod) {
			ram = n.RAM.UsedRegular
			eph = n.EphemeralStorage.UsedRegular
		} else {
			ram = n.RAM.UsedOther
			eph = n.EphemeralStorage.UsedOther
		}
		ram.Add(podRAMRequest(pod))
		eph.Add(podEphemeralStorageRequest(pod))
	}
	n.RAM.updateAvailable(ghostsAreVisible)
	n.EphemeralStorage.updateAvailable(ghostsAreVisible)
}

// we only handle ghost workspaces as "ghost" if they are from our namespace!
func isGhostWorkspace(p *corev1.Pod, namespace string) bool {
	return p.Namespace == namespace &&
		wsk8s.IsGhostWorkspace(p)
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

// FindSpareGhostToDelete returns a ghost to delete if that is necessary to fit the pod onto the node
func (s *State) FindSpareGhostToDelete(nodeName string, pod *corev1.Pod, namespace string, ramSafetyBuffer *res.Quantity, reservedSlots map[string]*Slot) (ghostToDelete string, unscheduleable bool) {
	node, ok := s.Nodes[nodeName]
	if !ok {
		return "", false
	}
	if len(node.Ghosts) == 0 {
		return "", false
	}

	// check if there already is enough space even with ghosts
	ghostsVisible := true
	nodeWithGhostsVisible := node.copy()
	// make sure we do not see double (ghost + workspace that is meant to replace it), so remove all reserved
	// (not-yet-bound) workspaces
	for _, g := range nodeWithGhostsVisible.Ghosts {
		slot, exists := reservedSlots[g.Name]
		if !exists || slot.Bound {
			continue
		}
		// remove the pod that's only here because of a "reserved slot"
		for i, p := range nodeWithGhostsVisible.Pods {
			if p.Name == slot.Binding.Pod.Name {
				// wipe node.Pods[i] in O(1)
				lastIndex := len(nodeWithGhostsVisible.Pods) - 1
				nodeWithGhostsVisible.Pods[i] = nodeWithGhostsVisible.Pods[lastIndex]
				nodeWithGhostsVisible.Pods = nodeWithGhostsVisible.Pods[:lastIndex]
				break
			}
		}
	}
	nodeWithGhostsVisible.update(namespace, ramSafetyBuffer, ghostsVisible)
	if fitsOnNode(pod, nodeWithGhostsVisible) {
		// the pod fits onto the node (even with ghosts) we do not need to delete a ghost at all
		return "", false
	}

	// make sure every pod-to-schedule deletes a new ghost
	candidates := make([]*corev1.Pod, 0, len(node.Ghosts))
	for _, g := range node.Ghosts {
		if slot, reserved := reservedSlots[g.Name]; reserved {
			// make sure we do not exclude our reserved ghost as target slot
			if slot.Binding.Pod.Name != pod.Name {
				continue
			}
		}
		candidates = append(candidates, g)
	}
	if len(candidates) == 0 {
		// all candidates are already reserved: unscheduleable
		return "", true
	}

	// return the oldest ghost (for good measure)
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].ObjectMeta.CreationTimestamp.Time.Before(candidates[j].ObjectMeta.CreationTimestamp.Time)
	})
	return candidates[0].Name, false
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
	usedGhostGibs := toMiString(r.UsedGhost)
	usedHeadlessGibs := toMiString(r.UsedHeadless)
	usedOtherGibs := toMiString(r.UsedOther)
	totalGibs := toMiString(r.Total)
	availableGibs := toMiString(r.Available)

	return fmt.Sprintf("used %s(r)+%s(g)+%s(h)+%s(o) of %s, avail %s Mi", usedRegularGibs, usedGhostGibs, usedHeadlessGibs, usedOtherGibs, totalGibs, availableGibs)
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

// DebugStringNodes prints available RAM per node as string for debug purposes
func DebugStringPodsOnNodes(nodes ...*Node) string {
	lines := make([]string, 0, len(nodes)*3)
	for _, node := range nodes {
		lines = append(lines, fmt.Sprintf("- %s:", node.Node.Name))
		pds := make([]string, 0, len(node.Pods))
		for _, p := range node.Pods {
			pds = append(pds, p.Name)
		}
		lines = append(lines, fmt.Sprintf("  pods: %s", strings.Join(pds, ", ")))

		gs := make([]string, 0, len(node.Ghosts))
		for _, g := range node.Ghosts {
			gs = append(gs, g.Name)
		}
		lines = append(lines, fmt.Sprintf("  ghosts: %s", strings.Join(gs, ", ")))
	}
	return strings.Join(lines, "\n")
}
