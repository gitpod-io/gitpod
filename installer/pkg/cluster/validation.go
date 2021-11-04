// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cluster

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	_ "k8s.io/client-go/plugin/pkg/client/auth" // https://github.com/kubernetes/client-go/issues/242
	"k8s.io/client-go/rest"
)

type ValidationStatus string

const (
	ValidationStatusOk      ValidationStatus = "OK"
	ValidationStatusError   ValidationStatus = "ERROR"
	ValidationStatusWarning ValidationStatus = "WARNING"
)

type ValidationError struct {
	Message string           `json:"message"`
	Type    ValidationStatus `json:"type"`
}

type ValidationCheck struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Check       ValidationCheckFunc `json:"-"`
}

type ValidationCheckFunc func(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error)

type ValidationItem struct {
	ValidationCheck
	Status ValidationStatus  `json:"status"`
	Errors []ValidationError `json:"errors,omitempty"` // Only populated if present
}

type ValidationResult struct {
	Status ValidationStatus `json:"status"`
	Items  []ValidationItem `json:"items"`
}

// ClusterChecks are checks against for a cluster
var ClusterChecks = ValidationChecks{
	{
		Name:        "Linux kernel version",
		Description: "all cluster nodes run Linux " + kernelVersionConstraint,
		Check:       checkKernelVersion,
	},
	{
		Name:        "containerd enabled",
		Check:       checkContainerDRuntime,
		Description: "all cluster nodes run containerd",
	},
	{
		Name:        "affinity labels",
		Check:       checkAffinityLabels,
		Description: "all required affinity node labels " + fmt.Sprint(AffinityList) + " are present in the cluster",
	},
	{
		Name:        "cert-manager installed",
		Check:       checkCertManagerInstalled,
		Description: "cert-manager is installed and has available issuer",
	},
}

// ValidationChecks are a group of validations
type ValidationChecks []ValidationCheck

func (v ValidationChecks) Len() int { return len(v) }

// Validate runs the checks
func (checks ValidationChecks) Validate(ctx context.Context, config *rest.Config, namespace string) (*ValidationResult, error) {
	results := &ValidationResult{
		Status: ValidationStatusOk,
		Items:  []ValidationItem{},
	}

	client, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	ctx = context.WithValue(ctx, keyClientset, client)

	list, err := listNodesFromContext(ctx, config)
	if err != nil {
		return nil, err
	}
	ctx = context.WithValue(ctx, keyNodeList, list)

	for _, check := range checks {
		result := ValidationItem{
			ValidationCheck: check,
			Status:          ValidationStatusOk,
			Errors:          []ValidationError{},
		}

		res, err := check.Check(ctx, config, namespace)
		if err != nil {
			return nil, err
		}
		for _, resultErr := range res {
			switch resultErr.Type {
			case ValidationStatusError:
				// Any error always changes status
				result.Status = ValidationStatusError
				results.Status = ValidationStatusError
			case ValidationStatusWarning:
				// Only put to warning if status is ok
				if result.Status == ValidationStatusOk {
					result.Status = ValidationStatusWarning
				}
				if results.Status == ValidationStatusOk {
					results.Status = ValidationStatusWarning
				}
			}

			result.Errors = append(result.Errors, resultErr)
		}

		results.Items = append(results.Items, result)
	}

	return results, nil
}

const (
	keyNodeList  = "nodeListKey"
	keyClientset = "clientset"
)

func listNodesFromContext(ctx context.Context, config *rest.Config) ([]corev1.Node, error) {
	client, err := clientsetFromContext(ctx, config)
	if err != nil {
		return nil, err
	}

	val := ctx.Value(keyNodeList)
	if res, ok := val.([]corev1.Node); ok && res != nil {
		return res, nil
	}

	nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return nodes.Items, nil
}

func clientsetFromContext(ctx context.Context, config *rest.Config) (kubernetes.Interface, error) {
	val := ctx.Value(keyClientset)
	if res, ok := val.(kubernetes.Interface); ok && res != nil {
		return res, nil
	}
	return kubernetes.NewForConfig(config)
}
