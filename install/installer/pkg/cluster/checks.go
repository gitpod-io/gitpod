// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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

const (
	// Allow pre-release range as GCP (and potentially others) use the patch for
	// additional information, which get interpreted as pre-release (eg, 1.2.3-rc4)
	kernelVersionConstraint     = ">= 5.4.0-0"
	kubernetesVersionConstraint = ">= 1.21.0-0"
)

// checkCertManagerInstalled checks that cert-manager is installed as a cluster dependency
func checkCertManagerInstalled(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
	client, err := certmanager.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	clusterIssuers, err := client.CertmanagerV1().ClusterIssuers().List(ctx, metav1.ListOptions{})
	if err != nil {
		// If cert-manager not installed, this will error
		return []ValidationError{
			{
				Message: err.Error(),
				Type:    ValidationStatusError,
			},
		}, nil
	}

	if len(clusterIssuers.Items) == 0 {
		// Treat as warning - may be bringing their own certs
		return []ValidationError{
			{
				Message: "no cluster issuers configured",
				Type:    ValidationStatusWarning,
			},
		}, nil
	}

	return nil, nil
}

// checkContainerDRuntime checks that the nodes are running with the containerd runtime
func checkContainerDRuntime(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
	nodes, err := ListNodesFromContext(ctx, config)
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

func checkKubernetesVersion(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
	// Allow pre-releases in case provider appends anything to the version
	constraint, err := semver.NewConstraint(kubernetesVersionConstraint)
	if err != nil {
		return nil, err
	}

	server, err := serverVersion(ctx, config)
	if err != nil {
		return nil, err
	}

	var res []ValidationError

	serverVersion, err := semver.NewVersion(server.GitVersion)
	if err != nil {
		res = append(res, ValidationError{
			Message: err.Error() + " Kubernetes version: " + server.GitVersion,
			Type:    ValidationStatusWarning,
		})
	}
	valid := constraint.Check(serverVersion)
	if !valid {
		res = append(res, ValidationError{
			Message: "Kubernetes version " + server.GitVersion + " does not satisfy " + kubernetesVersionConstraint,
			Type:    ValidationStatusError,
		})
	}

	nodes, err := ListNodesFromContext(ctx, config)
	if err != nil {
		return nil, err
	}
	for _, node := range nodes {
		kubeletVersion := node.Status.NodeInfo.KubeletVersion

		version, err := semver.NewVersion(kubeletVersion)
		if err != nil {
			// This means that the given version doesn't conform to semver format - user must decide
			res = append(res, ValidationError{
				Message: err.Error() + " Kubernetes version: " + kubeletVersion,
				Type:    ValidationStatusWarning,
			})
			break
		}

		valid := constraint.Check(version)

		if !valid {
			res = append(res, ValidationError{
				Message: "Kubelet version " + kubeletVersion + " does not satisfy " + kubernetesVersionConstraint + " on node: " + node.Name,
				Type:    ValidationStatusError,
			})
		}
	}

	return res, nil
}

type checkSecretOpts struct {
	RequiredFields    []string
	RecommendedFields []string
	Validator         func(*corev1.Secret) ([]ValidationError, error)
}

type CheckSecretOpt func(*checkSecretOpts)

func CheckSecretRequiredData(entries ...string) CheckSecretOpt {
	return func(cso *checkSecretOpts) {
		cso.RequiredFields = append(cso.RequiredFields, entries...)
	}
}

func CheckSecretRecommendedData(entries ...string) CheckSecretOpt {
	return func(cso *checkSecretOpts) {
		cso.RecommendedFields = append(cso.RecommendedFields, entries...)
	}
}

func CheckSecretRule(validator func(*corev1.Secret) ([]ValidationError, error)) CheckSecretOpt {
	return func(cso *checkSecretOpts) {
		cso.Validator = validator
	}
}

// CheckSecret produces a new check for an in-cluster secret
func CheckSecret(name string, opts ...CheckSecretOpt) ValidationCheck {
	var cfg checkSecretOpts
	for _, o := range opts {
		o(&cfg)
	}

	return ValidationCheck{
		Name:        name + " is present and valid",
		Description: "ensures the " + name + " secret is present and contains the required data",
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

			var res []ValidationError
			for _, k := range cfg.RequiredFields {
				_, ok := secret.Data[k]
				if !ok {
					res = append(res, ValidationError{
						Message: fmt.Sprintf("secret %s has no %s entry", name, k),
						Type:    ValidationStatusError,
					})
				}
			}
			for _, k := range cfg.RecommendedFields {
				_, ok := secret.Data[k]
				if !ok {
					res = append(res, ValidationError{
						Message: fmt.Sprintf("secret %s has no %s entry", name, k),
						Type:    ValidationStatusWarning,
					})
				}
			}

			if cfg.Validator != nil {
				vres, err := cfg.Validator(secret)
				if err != nil {
					return nil, err
				}
				res = append(res, vres...)
			}

			return res, nil
		},
	}
}

// checkKernelVersion checks the nodes are using the correct linux Kernel version
func checkKernelVersion(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
	constraint, err := semver.NewConstraint(kernelVersionConstraint)
	if err != nil {
		return nil, err
	}

	nodes, err := ListNodesFromContext(ctx, config)
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

func checkNamespaceExists(ctx context.Context, config *rest.Config, namespace string) ([]ValidationError, error) {
	client, err := clientsetFromContext(ctx, config)
	if err != nil {
		return nil, err
	}

	namespaces, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	namespaceExists := false
	for _, nsp := range namespaces.Items {
		if !namespaceExists && nsp.Name == namespace {
			namespaceExists = true
			break
		}
	}

	if !namespaceExists {
		return []ValidationError{
			{
				Message: fmt.Sprintf("Namespace %s does not exist", namespace),
				Type:    ValidationStatusError,
			},
		}, nil
	}

	return nil, nil
}
