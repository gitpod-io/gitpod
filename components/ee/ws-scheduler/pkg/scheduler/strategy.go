// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	"math"
	"sort"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"

	log "github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	corev1 "k8s.io/api/core/v1"
)

// StrategyName is the type that identifies strategies
type StrategyName string

const (
	// StrategyEvenLoadSpots identifies the EvenLoadSpots schedule strategy
	StrategyEvenLoadSpots StrategyName = "EvenLoadSpots"
	// StrategyEvenLoad identifies the EvenLoad schedule strategy
	StrategyEvenLoad StrategyName = "EvenLoad"
	// StrategyDensityAndExperience identifies the DensityAndExperience schedule strategy
	StrategyDensityAndExperience StrategyName = "DensityAndExperience"
)

const (
	errorNoNodeWithEnoughResourcesAvailable = "No node with enough resources available!\nRAM requested: %s\nEph. Storage requested: %s\nNodes:\n%s"
)

// Strategy is the interface that make the actual scheduling interchangable
type Strategy interface {
	// Selects a node for the given Pod based on the current State
	// ("", err) => PodReasonUnschedulable, err contains explanaition
	// (<string>, nil) => successful scheduling
	Select(state *State, pod *corev1.Pod) (nodeName string, err error)
}

// CreateStrategy creates a Strategy for the given name
func CreateStrategy(name StrategyName, config Configuration) (Strategy, error) {
	switch name {
	case StrategyEvenLoadSpots:
		return &EvenLoadSpots{}, nil
	case StrategyEvenLoad:
		return &EvenLoad{}, nil
	case StrategyDensityAndExperience:
		var strategyConfig = config.DensityAndExperienceConfig
		if strategyConfig == nil {
			strategyConfig = DefaultDensityAndExperienceConfig()
		}
		return &DensityAndExperience{
			Config: *strategyConfig,
		}, nil
	default:
		return nil, xerrors.Errorf("unable to match Strategy name '%s'!", name)
	}
}

// EvenLoadSpots scheduling: Assigns pods to the node least used node
type EvenLoadSpots struct {
}

// Select will assign pods to the node with the least ressources used
func (e *EvenLoadSpots) Select(state *State, pod *corev1.Pod) (string, error) {
	type candidateNode struct {
		Node           *Node
		SpotsAvailable int
	}

	allNodes := state.Nodes
	availableNodes := make([]candidateNode, 0)
	for _, n := range allNodes {
		req := podRAMRequest(pod)
		spotsAvailable := int(n.Node.Status.Allocatable.Memory().Value() / req.Value())
		if int64(spotsAvailable) > n.PodSlots.Available {
			spotsAvailable = int(n.PodSlots.Available)
		}
		if spotsAvailable == 0 {
			continue
		}

		availableNodes = append(availableNodes, candidateNode{n, spotsAvailable})
	}

	if len(availableNodes) == 0 {
		return "", xerrors.Errorf("no node available")
	}

	// Sorting for multiple criteria using this kind of less function is a bit tricky. The important thing
	// is to maintain the correct "order" within a sorting condition, i.e. ascending "if i < j { return true }"
	// and for descending "if i > j { return false }".
	sort.Slice(availableNodes, func(i, j int) bool {
		ni := availableNodes[i]
		nj := availableNodes[j]

		// Sort ascending by spots available.
		// We want to pack on to nodes who have the most workspaces already, so that we pack densely.
		if ni.SpotsAvailable < nj.SpotsAvailable {
			return true
		}

		// sort ascending by RAM use
		if ni.Node.Node.Status.Allocatable.Memory().Cmp(*nj.Node.Node.Status.Allocatable.Memory()) > 0 {
			return false
		}

		return false
	})
	return availableNodes[0].Node.Node.Name, nil
}

// EvenLoad scheduling: Assigns pods to the node least used node
type EvenLoad struct {
}

// Select will assign pods to the node with the least ressources used
func (e *EvenLoad) Select(state *State, pod *corev1.Pod) (string, error) {
	sortedNodes := state.SortNodesByAvailableRAM(SortDesc)

	if len(sortedNodes) == 0 {
		requestedRAM := podRAMRequest(pod)
		requestedEphStorage := podEphemeralStorageRequest(pod)
		debugStr := DebugStringNodes(sortedNodes...)
		return "", xerrors.Errorf(errorNoNodeWithEnoughResourcesAvailable, requestedRAM.String(), requestedEphStorage.String(), debugStr)
	}

	candidate := sortedNodes[0]
	if !fitsOnNode(pod, candidate) {
		requestedRAM := podRAMRequest(pod)
		requestedEphStorage := podEphemeralStorageRequest(pod)
		debugStr := DebugStringNodes(sortedNodes...)
		return "", xerrors.Errorf(errorNoNodeWithEnoughResourcesAvailable, requestedRAM.String(), requestedEphStorage.String(), debugStr)
	}

	return candidate.Node.Name, nil
}

// DensityAndExperience is a strategy that aims to reach high workspace/node density while maintaining the best possible user experience
// by adding constraints like "do not schedule too much fresh pods on one node (if possible)"
type DensityAndExperience struct {
	Config DensityAndExperienceConfig
}

// Select for DensityAndExperience works as follows:
//  - try to assign to fullest node
//  - exception:
//	  - other nodes are available
//		AND the fullest node has other workspace started within the last X seconds (to avoid slowing down startup)
//  - Bonus points: if there are multiple preferred nodes available (because they are full to Y% and thus regarded as equal): schedule to the node which already has the workspace image (present in node.Status.Images)
func (s *DensityAndExperience) Select(state *State, pod *corev1.Pod) (string, error) {
	sortedNodes := state.SortNodesByUsedRegularWorkspaceRAM(SortDesc)

	var candidates []*Node
	for _, node := range sortedNodes {
		if !fitsOnNode(pod, node) {
			continue
		}
		candidates = append(candidates, node)
	}

	if len(candidates) == 0 {
		requestedRAM := podRAMRequest(pod)
		requestedEphStorage := podEphemeralStorageRequest(pod)
		debugStr := DebugStringNodes(sortedNodes...)
		return "", xerrors.Errorf(errorNoNodeWithEnoughResourcesAvailable, requestedRAM.String(), requestedEphStorage.String(), debugStr)
	}

	// From this point on we're safe: Choosing any of the candidates would work.
	defaultCandidate := candidates[0]
	// Now we're only concerned with the user experience - but only for non-headless workspaces!
	// Headless workspaces just mustn't break the user experience of non-headless ones. Hence we
	// want to schedule headless workspaces as far away from regular ones as we can.
	if isHeadlessWorkspace(pod) {
		// We try and find the least utilised node that still has regular workspaces on it.
		// This way we place the headless workspace "on the other end" of the cluster, but
		// don't prevent scale-down.
		for i := len(candidates) - 1; i >= 0; i-- {
			if regularWorkspaceCount(state, candidates[i]) > 0 {
				return candidates[i].Node.Name, nil
			}
		}

		// In case we didn't find a non-empty node, we'll place this headless workspace on the
		// same default candidate as we would for regular workspaces. This way we prevent cluster
		// "fragmentation" on either end of the pool. If we used candidates[len(candidates)-1] we
		// run the risk of keeping a node alive just for prebuilds, as headless workspaces don't
		// count into the regular workspace count.
		return defaultCandidate.Node.Name, nil
	}

	// For user workspaces, we want to:
	//  - try to not schedule too many fresh workspaces onto the same node
	candidatesWoFreshWorkspaces := make([]*Node, 0)
	for _, node := range candidates {
		if freshWorkspaceCount(state, node, s.Config.WorkspaceFreshPeriodSeconds) < s.Config.NodeFreshWorkspaceLimit {
			candidatesWoFreshWorkspaces = append(candidatesWoFreshWorkspaces, node)
		}
	}

	if len(candidatesWoFreshWorkspaces) == 0 {
		// Not nice: Let's log to be able to identify these cases
		log.Debugf("Scheduling on node which already has a recent workspace")
		return defaultCandidate.Node.Name, nil
	}

	// Now we have a list of workspaces sorted by density, those with fresh workspaces excluded.
	// It would be awesome if we preferred the node which already has the image we need.
	// For that to not break our density-first approach we have to somehow classify our nodes and
	// make sure we are not going to do much worser than without. E.g., just because of a cached
	// an image, we do not want to keep an empty node alive
	{
		candidate := defaultCandidate
		candidatesClass := classifyNode(state, candidate)
		for _, nextCandidate := range candidates[1:] {
			// Take candidate if it's a match...
			if hasNeededImage(candidate, pod) {
				// Yeah, ideal case!
				return candidate.Node.Name, nil
			}

			// ...or nextCandidate would worsen things
			nextCandidatesClass := classifyNode(state, nextCandidate)
			if nextCandidatesClass < candidatesClass {
				// We do not want to worsen things: Just stick with the default choice
				break
			}
			candidate = nextCandidate
			candidatesClass = nextCandidatesClass
		}
	}

	return defaultCandidate.Node.Name, nil
}

// helper functions
func fitsOnNode(pod *corev1.Pod, node *Node) bool {
	ramReq := podRAMRequest(pod)
	ephStorageReq := podEphemeralStorageRequest(pod)
	return ramReq.Cmp(*node.RAM.Available) <= 0 &&
		(ephStorageReq.CmpInt64(0) == 0 || ephStorageReq.Cmp(*node.EphemeralStorage.Available) <= 0)
}

func freshWorkspaceCount(state *State, node *Node, freshSeconds int) int {
	var count int
	for _, p := range node.Pods {
		if !isWorkspace(p) {
			continue
		}
		if time.Since(p.ObjectMeta.CreationTimestamp.Time).Seconds() < float64(freshSeconds) {
			count = count + 1
		}
	}
	return count
}

func hasNeededImage(node *Node, pod *corev1.Pod) bool {
	var imageName = ""
	for _, container := range pod.Spec.Containers {
		if container.Name == "workspace" {
			imageName = container.Image
		}
	}
	if imageName == "" {
		log.Warnf("unable to get workspace image name from pod: %s", pod.Name)
		return false
	}

	for _, image := range node.Node.Status.Images {
		for _, name := range image.Names {
			if name == imageName {
				return true
			}
		}
	}
	return false
}

func classifyNode(state *State, node *Node) int {
	if regularWorkspaceCount(state, node) == 0 {
		// This makes sure that nodes without workspaces are actually observed as being "empty" which might not be the
		// case due to other services running on that node.
		return 0
	}

	used := float64(node.RAM.UsedRegular.Value())
	total := float64(node.RAM.Total.Value())
	result := int(math.Floor((used / total) * 10))
	if result >= 7 {
		result = 7
	}
	return result
}

// regularRorkspaceCount counts the number of workspaces on the node.
// The returned count will not include headless workspaces. E.g. if a node has only headless
// workspaces running on it we'd return zero.
func regularWorkspaceCount(state *State, node *Node) int {
	var count int
	for _, p := range node.Pods {
		if !isWorkspace(p) {
			continue
		}
		if isHeadlessWorkspace(p) {
			continue
		}

		count = count + 1
	}
	return count
}

func isWorkspace(pod *corev1.Pod) bool {
	val, ok := pod.ObjectMeta.Labels["component"]
	return ok && val == "workspace"
}

func isHeadlessWorkspace(pod *corev1.Pod) bool {
	if !isWorkspace(pod) {
		return false
	}

	val, ok := pod.ObjectMeta.Labels["headless"]
	return ok && val == "true"
}

func isGhostWorkspace(pod *corev1.Pod) bool {
	if !isWorkspace(pod) {
		return false
	}

	val, ok := pod.ObjectMeta.Labels[wsk8s.TypeLabel]
	return ok && val == "ghost"
}

func IsRegularWorkspace(pod *corev1.Pod) bool {
	if !isWorkspace(pod) {
		return false
	}

	val, ok := pod.ObjectMeta.Labels[wsk8s.TypeLabel]
	return ok && val == "regular"
}
