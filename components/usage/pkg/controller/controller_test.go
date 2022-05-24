// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestController(t *testing.T) {
	schedule := time.Second
	triggered := false

	ctrl, err := New(schedule, ReconcilerFunc(func() error {
		triggered = true
		return nil
	}))
	require.NoError(t, err)

	require.NoError(t, ctrl.Start())
	time.Sleep(schedule + 20*time.Millisecond)
	require.True(t, triggered, "must trigger reconciler function")
	ctrl.Stop()
}

func TestController_GracefullyHandlesPanic(t *testing.T) {
	ctrl, err := New(20*time.Millisecond, ReconcilerFunc(func() error {
		panic("pls help")
	}))
	require.NoError(t, err)

	require.NoError(t, ctrl.Start())
	ctrl.Stop()
}
