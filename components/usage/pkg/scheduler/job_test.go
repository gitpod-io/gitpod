// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"github.com/stretchr/testify/require"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestPreventConcurrentInvocation(t *testing.T) {
	callCount := int32(0)
	job := WithoutConcurrentRun(JobFunc(func() error {
		atomic.AddInt32(&callCount, 1)
		time.Sleep(50 * time.Millisecond)
		return nil
	}))

	invocations := 3
	wg := sync.WaitGroup{}
	wg.Add(invocations)
	for i := 0; i < invocations; i++ {
		go func() {
			_ = job.Run()
			wg.Done()
		}()
	}
	wg.Wait()

	require.Equal(t, int32(1), callCount)
}

func TestPreventConcurrentInvocation_CanRunRepeatedly(t *testing.T) {
	callCount := int32(0)
	job := WithoutConcurrentRun(JobFunc(func() error {
		atomic.AddInt32(&callCount, 1)
		return nil
	}))

	require.NoError(t, job.Run())
	require.NoError(t, job.Run())

	require.Equal(t, int32(2), callCount)
}
