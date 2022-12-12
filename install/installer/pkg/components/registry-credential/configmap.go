// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package registry_credential

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/registry-credential/pkg/config"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !isAWSRegistry(ctx) {
		return []runtime.Object{}, nil
	}

	credentialSecretName, err := credentialSecretName(ctx)
	if err != nil {
		return nil, err
	}

	region := getAWSRegion(ctx.Config.ContainerRegistry.External.URL)

	secretToUpdateName, err := secretToUpdateName(ctx)
	if err != nil {
		return nil, err
	}

	registryCredentialCfg := config.Configuration{
		Namespace:        ctx.Namespace,
		CredentialSecret: credentialSecretName,
		Region:           region,
		SecretToUpdate:   secretToUpdateName,
	}

	json, err := common.ToJSONString(registryCredentialCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal %s config: %w", Component, err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"registry-credential.json": string(json),
			},
		},
	}, nil
}

func secretToUpdateName(ctx *common.RenderContext) (string, error) {
	var secretName string
	if ctx.Config.ContainerRegistry.External != nil {
		secretName = ctx.Config.ContainerRegistry.External.Certificate.Name
	} else {
		return "", fmt.Errorf("%s: invalid container registry config", Component)
	}
	return secretName, nil
}

func credentialSecretName(ctx *common.RenderContext) (string, error) {
	var secretName string
	if ctx.Config.ContainerRegistry.External != nil {
		secretName = ctx.Config.ContainerRegistry.External.Credential.Name
	} else {
		return "", fmt.Errorf("%s: invalid container registry config", Component)
	}
	return secretName, nil
}
