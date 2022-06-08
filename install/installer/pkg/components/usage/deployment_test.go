// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package usage

import (
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"testing"
)

func TestDeployment_ContainsDBEnvVars(t *testing.T) {
	ctx := renderContextWithUsageEnabled(t)

	objs, err := deployment(ctx)
	require.NoError(t, err)

	dpl, ok := objs[0].(*appsv1.Deployment)
	require.True(t, ok)

	containers := dpl.Spec.Template.Spec.Containers
	require.Len(t, containers, 2)

	usageContainer := containers[0]
	secretRef := corev1.LocalObjectReference{Name: ctx.Config.Database.CloudSQL.ServiceAccount.Name}

	require.Contains(t, usageContainer.Env, corev1.EnvVar{
		Name:  "DB_HOST",
		Value: "cloudsqlproxy",
	})
	require.Contains(t, usageContainer.Env, corev1.EnvVar{
		Name:  "DB_PORT",
		Value: "3306",
	})
	require.Contains(t, usageContainer.Env, corev1.EnvVar{
		Name: "DB_PASSWORD",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: secretRef,
			Key:                  "password",
		}},
	})
	require.Contains(t, usageContainer.Env, corev1.EnvVar{
		Name: "DB_USERNAME",
		ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: secretRef,
			Key:                  "username",
		}},
	})
}
