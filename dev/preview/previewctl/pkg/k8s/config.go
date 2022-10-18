// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package k8s

import (
	"context"
	"fmt"
	"strings"

	"github.com/cockroachdb/errors"
	"github.com/imdario/mergo"
	"github.com/sirupsen/logrus"
	authorizationv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

var (
	ErrContextNotExists = errors.New("context doesn't exist")
)

type Config struct {
	coreClient    kubernetes.Interface
	dynamicClient dynamic.Interface

	logger *logrus.Logger
}

func NewWithConfig(logger *logrus.Logger, config *rest.Config) (*Config, error) {
	coreClient := kubernetes.NewForConfigOrDie(config)
	dynamicClient := dynamic.NewForConfigOrDie(config)

	return &Config{
		coreClient:    coreClient,
		dynamicClient: dynamicClient,
		logger:        logger,
	}, nil
}

func NewFromDefaultConfigWithContext(logger *logrus.Logger, contextName string) (*Config, error) {
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
		if strings.Contains(err.Error(), "does not exist") {
			return nil, errors.Mark(err, ErrContextNotExists)
		}
		return nil, err
	}

	return kconf, err
}

func RenameContext(config *api.Config, oldName, newName string) (*api.Config, error) {
	kubeCtx, exists := config.Contexts[oldName]
	if !exists {
		return nil, fmt.Errorf("cannot rename %q, it's not in the provided context", oldName)
	}

	if _, newExists := config.Contexts[newName]; newExists {
		return nil, fmt.Errorf("cannot rename %q, it already exists in the provided context", oldName)
	}

	config.Contexts[newName] = kubeCtx
	delete(config.Contexts, oldName)

	if config.CurrentContext == oldName {
		config.CurrentContext = newName
	}

	return config, nil
}

func MergeWithDefaultConfig(configs ...*api.Config) (*api.Config, error) {
	defaultConfig, err := clientcmd.NewDefaultClientConfigLoadingRules().Load()
	if err != nil {
		return nil, err
	}

	mapConfig := api.NewConfig()
	err = mergo.Merge(mapConfig, defaultConfig, mergo.WithOverride)
	if err != nil {
		return nil, err
	}

	// If the same contexts exist in the default config, we'll override them with the configs we merge
	for _, config := range configs {
		err = mergo.Merge(mapConfig, config, mergo.WithOverride)
		if err != nil {
			return nil, err
		}
	}

	return mapConfig, nil
}

func (c *Config) HasAccess() bool {
	sar := &authorizationv1.SelfSubjectAccessReview{
		Spec: authorizationv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authorizationv1.ResourceAttributes{
				Namespace: "default",
				Verb:      "get",
				Group:     "secrets",
			},
		},
	}

	_, err := c.coreClient.AuthorizationV1().SelfSubjectAccessReviews().Create(context.TODO(), sar, metav1.CreateOptions{})
	if err != nil {
		c.logger.Error(err)
		return false
	}

	return true
}
