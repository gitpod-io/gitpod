// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package internal

import (
	"golang.org/x/xerrors"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
)

// The following is copied from github.com/kubernetes/kubernetes because it's not part of the public API and we need it

// github.com/kubernetes/kubernetes/pkg/scheduler/algorithm/predicates/predicates.go

// NodeMatchesNodeSelectorTerms checks if a node's labels satisfy a list of node selector terms,
// terms are ORed, and an empty list of terms will match nothing.
func NodeMatchesNodeSelectorTerms(node *corev1.Node, nodeSelectorTerms []corev1.NodeSelectorTerm) bool {
	nodeFields := map[string]string{}
	for k, f := range nodeFieldSelectorKeys {
		nodeFields[k] = f(node)
	}
	return matchNodeSelectorTerms(nodeSelectorTerms, labels.Set(node.Labels), fields.Set(nodeFields))
}

// github.com/kubernetes/kubernetes/pkg/scheduler/algorithm/types.go

// nodeFieldSelectorKeys copied from algorithm/types.go
var nodeFieldSelectorKeys = map[string]func(*corev1.Node) string{
	"metadata.name": func(n *corev1.Node) string { return n.Name },
}

// github.com/kubernetes/kubernetes/pkg/apis/core/v1/helper/helpers.go

// matchNodeSelectorTerms checks whether the node labels and fields match node selector terms in ORed;
// nil or empty term matches no objects.
func matchNodeSelectorTerms(
	nodeSelectorTerms []corev1.NodeSelectorTerm,
	nodeLabels labels.Set,
	nodeFields fields.Set,
) bool {
	for _, req := range nodeSelectorTerms {
		// nil or empty term selects no objects
		if len(req.MatchExpressions) == 0 && len(req.MatchFields) == 0 {
			continue
		}

		if len(req.MatchExpressions) != 0 {
			labelSelector, err := nodeSelectorRequirementsAsSelector(req.MatchExpressions)
			if err != nil || !labelSelector.Matches(nodeLabels) {
				continue
			}
		}

		if len(req.MatchFields) != 0 {
			fieldSelector, err := nodeSelectorRequirementsAsFieldSelector(req.MatchFields)
			if err != nil || !fieldSelector.Matches(nodeFields) {
				continue
			}
		}

		return true
	}

	return false
}

// nodeSelectorRequirementsAsSelector converts the []NodeSelectorRequirement api type into a struct that implements
// labels.Selector.
func nodeSelectorRequirementsAsSelector(nsm []corev1.NodeSelectorRequirement) (labels.Selector, error) {
	if len(nsm) == 0 {
		return labels.Nothing(), nil
	}
	selector := labels.NewSelector()
	for _, expr := range nsm {
		var op selection.Operator
		switch expr.Operator {
		case corev1.NodeSelectorOpIn:
			op = selection.In
		case corev1.NodeSelectorOpNotIn:
			op = selection.NotIn
		case corev1.NodeSelectorOpExists:
			op = selection.Exists
		case corev1.NodeSelectorOpDoesNotExist:
			op = selection.DoesNotExist
		case corev1.NodeSelectorOpGt:
			op = selection.GreaterThan
		case corev1.NodeSelectorOpLt:
			op = selection.LessThan
		default:
			return nil, xerrors.Errorf("%q is not a valid node selector operator", expr.Operator)
		}
		r, err := labels.NewRequirement(expr.Key, op, expr.Values)
		if err != nil {
			return nil, err
		}
		selector = selector.Add(*r)
	}
	return selector, nil
}

// nodeSelectorRequirementsAsFieldSelector converts the []NodeSelectorRequirement core type into a struct that implements
// fields.Selector.
func nodeSelectorRequirementsAsFieldSelector(nsm []corev1.NodeSelectorRequirement) (fields.Selector, error) {
	if len(nsm) == 0 {
		return fields.Nothing(), nil
	}

	selectors := []fields.Selector{}
	for _, expr := range nsm {
		switch expr.Operator {
		case corev1.NodeSelectorOpIn:
			if len(expr.Values) != 1 {
				return nil, xerrors.Errorf("unexpected number of value (%d) for node field selector operator %q",
					len(expr.Values), expr.Operator)
			}
			selectors = append(selectors, fields.OneTermEqualSelector(expr.Key, expr.Values[0]))

		case corev1.NodeSelectorOpNotIn:
			if len(expr.Values) != 1 {
				return nil, xerrors.Errorf("unexpected number of value (%d) for node field selector operator %q",
					len(expr.Values), expr.Operator)
			}
			selectors = append(selectors, fields.OneTermNotEqualSelector(expr.Key, expr.Values[0]))

		default:
			return nil, xerrors.Errorf("%q is not a valid node field selector operator", expr.Operator)
		}
	}

	return fields.AndSelectors(selectors...), nil
}
