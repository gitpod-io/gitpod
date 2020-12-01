// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"

	corev1 "k8s.io/api/core/v1"
	res "k8s.io/apimachinery/pkg/api/resource"
)

// State holds alle node
type State struct {
	Nodes    map[string]*Node
	Pods     map[string]*corev1.Pod
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

// NewState creates a fresh, clean state
func NewState() *State {
	return &State{
		Nodes: make(map[string]*Node),
		Pods:  make(map[string]*corev1.Pod),
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
	s.Pods[pod.Name] = pod

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
func (s *State) GetAssignedPods(node *Node) []*corev1.Pod {
	var assignedPods []*corev1.Pod
	for _, p := range s.Pods {
		if p.Spec.NodeName == node.Node.Name {
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

func uniquePods(pods []*corev1.Pod) []*corev1.Pod {
	if len(pods) == 0 {
		return pods
	}

	type value struct {
		pod   *corev1.Pod
		index int
	}
	uniqueKeys := make(map[string]value)
	var uniqueList []*corev1.Pod
	for i := 0; i < len(pods); i++ {
		p := pods[i]
		existingPod, present := uniqueKeys[p.Name]

		if !present {
			uniqueKeys[p.Name] = value{
				pod:   p,
				index: len(uniqueList),
			}
			uniqueList = append(uniqueList, p)
			continue
		}
		if existingPod.pod.Generation != 0 || p.Generation != 0 {
			// we first had to check if any generation field was non-zero, because the Generation field
			// is optional. It depends on the Kubernetes implementation if it's present at all.
			if p.Generation > existingPod.pod.Generation {
				// the other pod is newer than the one already in the uniqueList: take that!
				existingPod.pod = p
				uniqueList[existingPod.index] = p
			}
			continue
		}
		if existingPod.pod.ResourceVersion != "" && p.ResourceVersion != "" {
			// The docs say to intepret this value as opaque - in most cases the resource version is
			// a sequence number coming from etcd, hence can be used to impose order.
			existingRev, err0 := strconv.ParseInt(existingPod.pod.ResourceVersion, 10, 64)
			newRev, err1 := strconv.ParseInt(p.ResourceVersion, 10, 64)
			if (err0 == nil && err1 == nil) && newRev > existingRev {
				// the other pod is newer than the one already in the uniqueList: take that!
				existingPod.pod = p
				uniqueList[existingPod.index] = p
			}
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
		ramReq := GetRequestedRAMForPod(p)
		ephStorageReq := GetRequestedEphemeralStorageForPod(p)
		if isHeadlessWorkspace(p) {
			usedHeadlessRAM.Add(ramReq)
			usedHeadlessEphStorage.Add(ephStorageReq)
		} else if isWorkspace(p) {
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
		service, ok := p.ObjectMeta.Labels[wsk8s.GitpodNodeServiceLabel]
		if !ok {
			continue
		}
		var ready bool
		for _, c := range p.Status.Conditions {
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
