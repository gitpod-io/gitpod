// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package usage

import (
	"testing"

	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
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

func TestDeployment_EnablesPaymentWhenAStripeSecretIsPresent(t *testing.T) {
	ctx := renderContextWithStripeSecretSet(t)

	objs, err := deployment(ctx)
	require.NoError(t, err)

	dpl, ok := objs[0].(*appsv1.Deployment)
	require.True(t, ok)

	spec := dpl.Spec
	require.Contains(t, spec.Template.Spec.Volumes, corev1.Volume{
		Name: "stripe-secret",
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: "some-stripe-secret",
			},
		},
	})

	containers := dpl.Spec.Template.Spec.Containers
	require.Len(t, containers, 2)

	usageContainer := containers[0]

	require.Contains(t, usageContainer.VolumeMounts, corev1.VolumeMount{
		Name:      "stripe-secret",
		MountPath: stripeSecretMountPath,
		ReadOnly:  true,
	})
}

func TestDeployment_DisablesPaymentWhenAStripeSecretIsNotPresent(t *testing.T) {
	ctx := renderContextWithUsageEnabled(t)

	objs, err := deployment(ctx)
	require.NoError(t, err)

	dpl, ok := objs[0].(*appsv1.Deployment)
	require.True(t, ok)

	containers := dpl.Spec.Template.Spec.Containers
	require.Len(t, containers, 2)

	usageContainer := containers[0]

	for _, arg := range usageContainer.Args {
		require.NotContains(t, arg, "--stripe-secret-path")
	}
}
