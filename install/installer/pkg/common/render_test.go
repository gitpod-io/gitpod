// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package common

import (
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"testing"
)

func TestCompositeRenderFunc_NilObjectsNilError(t *testing.T) {
	f := CompositeRenderFunc(
		func(cfg *RenderContext) ([]runtime.Object, error) {
			return nil, nil
		})

	ctx, err := NewRenderContext(config.Config{}, versions.Manifest{}, "test_namespace")
	require.NoError(t, err)

	objects, err := f(ctx)
	require.NoError(t, err)
	require.Len(t, objects, 0)
}
