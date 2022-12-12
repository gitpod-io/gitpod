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
	if !IsAWSECRURL(ctx) {
		return nil, nil
	}

	privateRegistry := isPrivateAWSECRURL(ctx.Config.ContainerRegistry.External.URL)
	region := getAWSRegion(ctx.Config.ContainerRegistry.External.URL)

	credentialSecretName, err := credentialSecretName(ctx)
	if err != nil {
		return nil, err
	}

	secretToUpdateName, err := secretToUpdateName(ctx)
	if err != nil {
		return nil, err
	}

	registryCredentialCfg := config.Configuration{
		Namespace:        ctx.Namespace,
		CredentialSecret: credentialSecretName,
		Region:           region,
		PublicRegistry:   !privateRegistry,
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
				"config.json": string(json),
			},
		},
	}, nil
}

func secretToUpdateName(ctx *common.RenderContext) (string, error) {
	if ctx.Config.ContainerRegistry.External == nil {
		return "", fmt.Errorf("%s: invalid container registry config", Component)
	}
	return ctx.Config.ContainerRegistry.External.Certificate.Name, nil
}

func credentialSecretName(ctx *common.RenderContext) (string, error) {
	if ctx.Config.ContainerRegistry.External == nil {
		return "", fmt.Errorf("%s: invalid container registry config", Component)
	}
	return ctx.Config.ContainerRegistry.External.Credential.Name, nil
}
