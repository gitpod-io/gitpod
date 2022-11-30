// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package public_api_server

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/utils/pointer"

	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
)

func TestDeployment(t *testing.T) {
	ctx := renderContextWithPublicAPI(t)

	objects, err := deployment(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	dpl := objects[0].(*appsv1.Deployment)
	require.Len(t, dpl.Spec.Template.Spec.Containers, 2, "must render 2 containers")
}

func TestDeployment_ServerArguments(t *testing.T) {
	ctx := renderContextWithPublicAPI(t)

	objects, err := deployment(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	dpl := objects[0].(*appsv1.Deployment)
	containers := dpl.Spec.Template.Spec.Containers
	require.Equal(t, Component, containers[0].Name)

	apiContainer := containers[0]
	require.EqualValues(t, []string{
		"run",
		"--config=/config.json",
		`--json-log=true`,
	}, apiContainer.Args)

	require.Equal(t, []corev1.Volume{
		{
			Name: configmapVolume,
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: Component,
					},
				},
			},
		},
		{
			Name: "stripe-secret",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: "stripe-webhook-secret",
					Optional:   pointer.Bool(true),
				},
			},
		},
		{
			Name: "personal-access-token-signing-key",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: "personal-access-token-signing-key",
				},
			},
		},
	}, dpl.Spec.Template.Spec.Volumes, "must bind config as a volume")
}
