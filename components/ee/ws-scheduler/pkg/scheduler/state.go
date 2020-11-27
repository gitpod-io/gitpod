// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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

// State holds alle node
type State struct {
	Nodes    map[string]*Node
	Pods     []*Pod
	Bindings []*Binding
}

// Node models a k8s node
type Node struct {
	Node *corev1.Node

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

// Pod models a k8s pod
type Pod struct {
	Pod *corev1.Pod
}

// Binding models a k8s binding pod -> node
type Binding struct {
	Pod      *Pod
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

// NewState creates a fresh, clean state
func NewState() *State {
	return &State{
		Nodes: make(map[string]*Node),
		Pods:  []*Pod{},
	}
}

// UpdateNodes integrates the given node into the current state
func (s *State) UpdateNodes(nodes []*corev1.Node) {
	for _, node := range nodes {
		s.UpdateNode(node)
	}
}

// UpdateNode integrates the given node into the current state
func (s *State) UpdateNode(node *corev1.Node) {
	n := s.Nodes[node.Name]
	if n == nil {
		n = createNodeFrom(node)
		s.Nodes[node.Name] = n
	} else {
		n.update(node)
	}

	s.updateAssignedPods(n)
}

// UpdatePods integrates the given pods into the current state
func (s *State) UpdatePods(pods []*corev1.Pod) {
	for _, pod := range pods {
		s.UpdatePod(pod)
	}
}

// UpdatePod integrates the given pod into the current state
func (s *State) UpdatePod(pod *corev1.Pod) {
	p := s.findPodByName(pod)
	if p == nil {
		p = createPodFrom(pod)
		s.Pods = append(s.Pods, p)
	} else {
		p.update(pod)
	}

	for _, n := range s.Nodes {
		s.updateAssignedPods(n)
	}
}

// UpdateBindings integrates the given bindings into the current state
func (s *State) UpdateBindings(bindings []*Binding) {
	s.Bindings = bindings

	for _, n := range s.Nodes {
		s.updateAssignedPods(n)
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

// SortNodesByAvailableRAMDesc returns the list of nodes from state sorted by .RAM.Available (descending)
func (s *State) SortNodesByAvailableRAMDesc() []*Node {
	nodes := NodeMapToList(s.Nodes)
	sort.Slice(nodes, func(i, j int) bool {
		return nodes[i].RAM.Available.AsDec().Cmp(nodes[j].RAM.Available.AsDec()) > 0
	})
	return nodes
}

// SortNodesByAvailableRAMAsc returns the list of nodes from state sorted by .RAM.Available (ascending)
func (s *State) SortNodesByAvailableRAMAsc() []*Node {
	nodes := NodeMapToList(s.Nodes)
	sort.Slice(nodes, func(i, j int) bool {
		return nodes[i].RAM.Available.AsDec().Cmp(nodes[j].RAM.Available.AsDec()) <= 0
	})
	return nodes
}

// GetAssignedPods returns the list of pods for the given node
func (s *State) GetAssignedPods(node *Node) []*Pod {
	assignedPods := make([]*Pod, 0)
	for _, p := range s.Pods {
		if p.Pod.Spec.NodeName == node.Node.Name {
			assignedPods = append(assignedPods, p)
		}
	}
	for _, b := range s.Bindings {
		if b.NodeName == node.Node.Name {
			assignedPods = append(assignedPods, b.Pod)
		}
	}

	// Now, as we merge from two different sources, have to make sure that we remove duplicates
	// (precedence for the newest) so that we do not calculate pods twice
	return uniquePods(assignedPods)
}

func uniquePods(pods []*Pod) []*Pod {
	type value struct {
		pod   *Pod
		index int
	}
	uniqueKeys := make(map[string]value)
	uniqueList := []*Pod{}
	for i := 0; i < len(pods); i++ {
		p := pods[i]
		existingPod, present := uniqueKeys[p.Pod.Name]
		if !present {
			uniqueKeys[p.Pod.Name] = value{
				pod:   p,
				index: len(uniqueList),
			}
			uniqueList = append(uniqueList, p)
		} else if existingPod.pod.Pod.Generation < p.Pod.Generation {
			// the other pod is newer than the one already in the uniqueList: take that!
			existingPod.pod = p
			uniqueList[existingPod.index] = p
		}
	}
	return uniqueList
}

// GetRequestedRAMForPod calculates the amount of RAM requested by all containers of the given pod
func GetRequestedRAMForPod(pod *corev1.Pod) res.Quantity {
	requestedRAM := res.NewQuantity(0, res.BinarySI)
	for _, c := range pod.Spec.Containers {
		requestedRAM.Add(*c.Resources.Requests.Memory())
	}
	return *requestedRAM
}

// GetRequestedEphemeralStorageForPod calculates the amount of ephemeral storage requested by all containers of the given pod
func GetRequestedEphemeralStorageForPod(pod *corev1.Pod) res.Quantity {
	requestedEphStorage := res.NewQuantity(0, res.BinarySI)
	for _, c := range pod.Spec.Containers {
		requestedEphStorage.Add(*c.Resources.Requests.StorageEphemeral())
	}
	return *requestedEphStorage
}

func (s *State) updateAssignedPods(node *Node) {
	assignedPods := s.GetAssignedPods(node)

	usedOtherRAM := res.NewQuantity(0, res.BinarySI)
	usedHeadlessRAM := res.NewQuantity(0, res.BinarySI)
	usedRegularRAM := res.NewQuantity(0, res.BinarySI)
	usedOtherEphStorage := res.NewQuantity(0, res.BinarySI)
	usedHeadlessEphStorage := res.NewQuantity(0, res.BinarySI)
	usedRegularEphStorage := res.NewQuantity(0, res.BinarySI)
	for _, p := range assignedPods {
		ramReq := GetRequestedRAMForPod(p.Pod)
		ephStorageReq := GetRequestedEphemeralStorageForPod(p.Pod)
		if isHeadlessWorkspace(p.Pod) {
			usedHeadlessRAM.Add(ramReq)
			usedHeadlessEphStorage.Add(ephStorageReq)
		} else if isWorkspace(p.Pod) {
			usedRegularRAM.Add(ramReq)
			usedRegularEphStorage.Add(ephStorageReq)
		} else {
			usedOtherRAM.Add(ramReq)
			usedOtherEphStorage.Add(ephStorageReq)
		}
	}

	avRAM := node.RAM.Total.DeepCopy()
	node.RAM.Available = &avRAM
	node.RAM.Available.Sub(*usedOtherRAM)
	node.RAM.Available.Sub(*usedHeadlessRAM)
	node.RAM.Available.Sub(*usedRegularRAM)
	node.RAM.UsedOther = usedOtherRAM
	node.RAM.UsedHeadless = usedHeadlessRAM
	node.RAM.UsedRegular = usedRegularRAM

	avEphStorage := node.EphemeralStorage.Total.DeepCopy()
	node.EphemeralStorage.Available = &avEphStorage
	node.EphemeralStorage.Available.Sub(*usedOtherEphStorage)
	node.EphemeralStorage.Available.Sub(*usedHeadlessEphStorage)
	node.EphemeralStorage.Available.Sub(*usedRegularEphStorage)
	node.EphemeralStorage.UsedOther = usedOtherEphStorage
	node.EphemeralStorage.UsedHeadless = usedHeadlessEphStorage
	node.EphemeralStorage.UsedRegular = usedRegularEphStorage

	node.PodSlots.Available = node.PodSlots.Total - int64(len(assignedPods))

	node.Services = make(map[string]struct{})
	for _, p := range assignedPods {
		service, ok := p.Pod.ObjectMeta.Labels[wsk8s.GitpodNodeServiceLabel]
		if !ok {
			continue
		}
		node.Services[service] = struct{}{}
	}
}

func (s *State) findPodByName(pod *corev1.Pod) *Pod {
	for _, p := range s.Pods {
		if p.Pod.Name == pod.Name {
			return p
		}
	}
	return nil
}

func createNodeFrom(node *corev1.Node) *Node {
	n := &Node{}
	n.update(node)
	return n
}

func (n *Node) update(node *corev1.Node) {
	n.Node = node

	totalRAM := node.Status.Allocatable.Memory().DeepCopy()
	availableRAM := node.Status.Allocatable.Memory().DeepCopy()
	n.RAM.Total = &totalRAM
	n.RAM.Available = &availableRAM

	totalEphemeralStorage := node.Status.Allocatable.StorageEphemeral().DeepCopy()
	availableEphemeralStorage := node.Status.Allocatable.StorageEphemeral().DeepCopy()
	n.EphemeralStorage.Total = &totalEphemeralStorage
	n.EphemeralStorage.Available = &availableEphemeralStorage

	n.PodSlots.Total = node.Status.Capacity.Pods().Value()
	n.PodSlots.Available = n.PodSlots.Total
}

func createPodFrom(pod *corev1.Pod) *Pod {
	p := &Pod{}
	p.update(pod)
	return p
}

func (p *Pod) update(pod *corev1.Pod) {
	p.Pod = pod
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
func (ru *ResourceUsage) DebugStringResourceUsage() string {
	usedRegularGibs := float64(ru.UsedRegular.Value()/1024/1024) / float64(1024)
	usedHeadlessGibs := float64(ru.UsedHeadless.Value()/1024/1024) / float64(1024)
	usedOtherGibs := float64(ru.UsedOther.Value()/1024/1024) / float64(1024)
	totalGibs := float64(ru.Total.Value()/1024/1024) / float64(1024)
	availableGibs := float64(ru.Available.Value()/1024/1024) / float64(1024)

	return fmt.Sprintf("used %0.03f+%0.03f+%0.3f of %0.3f, avail %0.03f GiB", usedRegularGibs, usedHeadlessGibs, usedOtherGibs, totalGibs, availableGibs)
}

// DebugStringNodes prints available RAM per node as string for debug purposes
func DebugStringNodes(nodes []*Node) string {
	lines := make([]string, 0, len(nodes)*3)
	for _, node := range nodes {
		lines = append(lines, fmt.Sprintf("- %s:", node.Node.Name))
		lines = append(lines, fmt.Sprintf("  RAM: %s", node.RAM.DebugStringResourceUsage()))
		lines = append(lines, fmt.Sprintf("  Eph. Storage: %s", node.EphemeralStorage.DebugStringResourceUsage()))
	}
	return strings.Join(lines, "\n")
}
