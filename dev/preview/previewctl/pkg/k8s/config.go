// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package k8s

import (
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Config struct {
	coreClient    kubernetes.Interface
	dynamicClient dynamic.Interface

	logger *logrus.Logger
}

func New(logger *logrus.Logger, contextName string) (*Config, error) {
	kconf, err := getKubernetesConfig(contextName)
	if err != nil {
		return nil, errors.Wrapf(err, "couldn't get [%s] kube context", contextName)
	}

	coreClient := kubernetes.NewForConfigOrDie(kconf)
	dynamicClient := dynamic.NewForConfigOrDie(kconf)

	return &Config{
		coreClient:    coreClient,
		dynamicClient: dynamicClient,
		logger:        logger,
	}, nil
}

func getKubernetesConfig(context string) (*rest.Config, error) {
	configLoadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	configOverrides := &clientcmd.ConfigOverrides{CurrentContext: context}

	kconf, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(configLoadingRules, configOverrides).ClientConfig()
	if err != nil {
		return nil, err
	}

	return kconf, err
}
