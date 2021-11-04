// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cluster

import (
	"context"
	"fmt"
	"strings"

	"github.com/Masterminds/semver"
	certmanager "github.com/jetstack/cert-manager/pkg/client/clientset/versioned"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
)

// checkAffinityLabels validates that the nodes have all the required affinity labels applied
// It assumes all the values are `true`
func checkAffinityLabels(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
	nodes, err := listNodesFromContext(ctx, config)
	if err != nil {
		return nil, err
	}

	affinityList := map[string]bool{}
	for _, affinity := range AffinityList {
		affinityList[affinity] = false
	}

	var res []ValidationError
	for _, node := range nodes {
		for k, v := range node.GetLabels() {
			if _, found := affinityList[k]; found {
				affinityList[k] = v == "true"
			}
		}
	}

	// Check all the values in the map are `true`
	for k, v := range affinityList {
		if !v {
			res = append(res, ValidationError{
				Message: "Affinity label not found in cluster: " + k,
				Type:    ValidationStatusError,
			})
		}
	}
	return res, nil
}

// checkCertManagerInstalled checks that cert-manager is installed as a cluster dependency
func checkCertManagerInstalled(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
	client, err := certmanager.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	clusterIssuers, err := client.CertmanagerV1().ClusterIssuers().List(ctx, metav1.ListOptions{})
	if err != nil {
		// If cert-manager not installed, this will error
		return []ValidationError{{
			Message: err.Error(),
			Type:    ValidationStatusError,
		}}, nil
	}

	if len(clusterIssuers.Items) == 0 {
		// Treat as warning - may be bringing their own certs
		return []ValidationError{{
			Message: "no cluster issuers configured",
			Type:    ValidationStatusWarning,
		}}, nil
	}

	return nil, nil
}

// checkContainerDRuntime checks that the nodes are running with the containerd runtime
func checkContainerDRuntime(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
	nodes, err := listNodesFromContext(ctx, config)
	if err != nil {
		return nil, err
	}

	var res []ValidationError
	for _, node := range nodes {
		runtime := node.Status.NodeInfo.ContainerRuntimeVersion
		if !strings.Contains(runtime, "containerd") {
			res = append(res, ValidationError{
				Message: "container runtime not containerd on node: " + node.Name + ", runtime: " + runtime,
				Type:    ValidationStatusError,
			})
		}
	}

	return res, nil
}

// CheckSecret produces a new check for an in-cluster secret
func CheckSecret(name, desc string, validator func(*corev1.Secret) ([]ValidationError, error)) ValidationCheck {
	return ValidationCheck{
		Name:        fmt.Sprintf("%s: %s is present and valid", desc, name),
		Description: fmt.Sprintf("%s: ensures the %s secret is present and contains the required data", desc, name),
		Check: func(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
			client, err := clientsetFromContext(ctx, config)
			if err != nil {
				return nil, err
			}

			secret, err := client.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
			if errors.IsNotFound(err) {
				return []ValidationError{
					{
						Message: "secret " + name + " not found",
						Type:    ValidationStatusError,
					},
				}, nil
			} else if err != nil {
				return nil, err
			}

			return validator(secret)
		},
	}
}

const (
	// Allow pre-release range as GCP (and potentially others) use the patch for
	// additional information, which get interpreted as pre-release (eg, 1.2.3-rc4)
	kernelVersionConstraint = ">= 5.4.0-0"
)

// checkKernelVersion checks the nodes are using the correct linux Kernel version
func checkKernelVersion(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
	constraint, err := semver.NewConstraint(kernelVersionConstraint)
	if err != nil {
		return nil, err
	}

	nodes, err := listNodesFromContext(ctx, config)
	if err != nil {
		return nil, err
	}

	var res []ValidationError
	for _, node := range nodes {
		kernelVersion := node.Status.NodeInfo.KernelVersion
		// Some GCP kernel versions contain a non-semver compatible suffix
		kernelVersion = strings.TrimSuffix(kernelVersion, "+")
		version, err := semver.NewVersion(kernelVersion)
		if err != nil {
			// This means that the given version doesn't conform to semver format - user must decide
			res = append(res, ValidationError{
				Message: err.Error() + " kernel version: " + kernelVersion,
				Type:    ValidationStatusWarning,
			})
			break
		}

		valid := constraint.Check(version)

		if !valid {
			res = append(res, ValidationError{
				Message: "kernel version " + kernelVersion + " does not satisfy " + kernelVersionConstraint + " on node: " + node.Name,
				Type:    ValidationStatusError,
			})
		}
	}

	return res, nil
}
