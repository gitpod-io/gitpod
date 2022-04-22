// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package public_api_server

import (
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	"testing"
)

func TestDeployment(t *testing.T) {
	ctx := renderContextWithPublicAPIEnabled(t)

	objects, err := deployment(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	dpl := objects[0].(*appsv1.Deployment)
	require.Len(t, dpl.Spec.Template.Spec.Containers, 2, "must render 2 containers")
}
