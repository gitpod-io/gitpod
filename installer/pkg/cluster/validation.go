// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cluster

import (
	"context"
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	v1 "k8s.io/api/core/v1"
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
	Name        string                                             `json:"name"`
	Description string                                             `json:"description"`
	Check       func(*v1.NodeList, *rest.Config) []ValidationError `json:"-"`
}

type ValidationItem struct {
	ValidationCheck
	Status ValidationStatus  `json:"status"`
	Errors []ValidationError `json:"errors,omitempty"` // Only populated if present
}

type ValidationResult struct {
	Status ValidationStatus `json:"status"`
	Items  []ValidationItem `json:"items"`
}

func ValidationChecks() []ValidationCheck {
	return []ValidationCheck{
		{
			Name:        "Kernel version",
			Description: "all cluster nodes run Linux " + kernelVersionConstraint,
			Check:       checkKernelVersion,
		},
		{
			Name:        "containerd enabled",
			Check:       checkContainerDRuntime,
			Description: "all cluster nodes run containerd",
		},
		{
			Name:        "Affinity labels",
			Check:       checkAffinityLabels,
			Description: "all required affinity node labels " + fmt.Sprint(common.AffinityList) + " are present in the cluster",
		},
		{
			Name:        "cert-manager installed",
			Check:       checkCertManagerInstalled,
			Description: "cert-manager is installed and has available issuer",
		},
	}
}

func Validate(client *kubernetes.Clientset, config *rest.Config) (*ValidationResult, error) {
	results := &ValidationResult{
		Status: ValidationStatusOk,
		Items:  []ValidationItem{},
	}

	nodes, err := client.CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	for _, check := range ValidationChecks() {
		result := ValidationItem{
			ValidationCheck: check,
			Status:          ValidationStatusOk,
			Errors:          []ValidationError{},
		}

		if errs := check.Check(nodes, config); len(errs) > 0 {
			// Failed error check
			for _, resultErr := range errs {
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
		}

		results.Items = append(results.Items, result)
	}

	return results, nil
}
