// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cluster

import (
	"context"
	"github.com/Masterminds/semver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	certmanager "github.com/jetstack/cert-manager/pkg/client/clientset/versioned"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
	"strings"
)

// checkAffinityLabels validates that the nodes all the correct affinity labels applied
// It assumes all the values are `true`
func checkAffinityLabels(list *v1.NodeList, _ *rest.Config) []ValidationError {
	affinityList := map[string]bool{}
	for _, affinity := range common.AffinityList {
		affinityList[affinity] = false
	}

	var resultErr []ValidationError
	for _, node := range list.Items {
		for k, v := range node.GetLabels() {
			if _, found := affinityList[k]; found {
				affinityList[k] = v == "true"
			}
		}
	}

	// Check all the values in the map are `true`
	for k, v := range affinityList {
		if !v {
			resultErr = append(resultErr, ValidationError{
				Message: "Affinity label not found in cluster: " + k,
				Type:    ValidationStatusError,
			})
		}
	}
	return resultErr
}

// checkCertManagerInstalled checks that cert-manager is installed as a cluster dependency
func checkCertManagerInstalled(_ *v1.NodeList, restConfig *rest.Config) []ValidationError {
	clientset, err := certmanager.NewForConfig(restConfig)
	if err != nil {
		return []ValidationError{{
			Message: err.Error(),
			Type:    ValidationStatusError,
		}}
	}

	clusterIssuers, err := clientset.CertmanagerV1().ClusterIssuers().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		// If cert-manager not installed, this will error
		return []ValidationError{{
			Message: err.Error(),
			Type:    ValidationStatusError,
		}}
	}

	if len(clusterIssuers.Items) == 0 {
		// Treat as warning - may be bringing their own certs
		return []ValidationError{{
			Message: "no cluster issuers configured",
			Type:    ValidationStatusWarning,
		}}
	}

	return nil
}

// checkContainerDRuntime checks that the nodes are running with the containerd runtime
func checkContainerDRuntime(list *v1.NodeList, _ *rest.Config) []ValidationError {
	var resultErr []ValidationError
	for _, node := range list.Items {
		runtime := node.Status.NodeInfo.ContainerRuntimeVersion
		if !strings.Contains(runtime, "containerd") {
			resultErr = append(resultErr, ValidationError{
				Message: "container runtime not containerd on node: " + node.Name + ", runtime: " + runtime,
				Type:    ValidationStatusError,
			})
		}
	}

	return resultErr
}

// checkKernelVersion checks the nodes are using the correct linux Kernel version
func checkKernelVersion(list *v1.NodeList, _ *rest.Config) []ValidationError {
	// Allow pre-release range as GCP (and potentially others) use the patch for
	// additional information, which get interpreted as pre-release (eg, 1.2.3-rc4)
	constraintString := ">= 5.4.0-0"
	constraint, err := semver.NewConstraint(constraintString)
	if err != nil {
		return []ValidationError{{
			Message: err.Error(),
			Type:    ValidationStatusError,
		}}
	}

	var resultErr []ValidationError
	for _, node := range list.Items {
		kernelVersion := node.Status.NodeInfo.KernelVersion
		version, err := semver.NewVersion(kernelVersion)
		if err != nil {
			// This means that the given version doesn't conform to semver format - user must decide
			resultErr = append(resultErr, ValidationError{
				Message: err.Error() + " kernel version: " + kernelVersion,
				Type:    ValidationStatusWarning,
			})
			break
		}

		valid := constraint.Check(version)

		if !valid {
			resultErr = append(resultErr, ValidationError{
				Message: "kernel version " + kernelVersion + " does not satisfy " + constraintString + " on node: " + node.Name,
				Type:    ValidationStatusError,
			})
		}
	}

	return resultErr
}
