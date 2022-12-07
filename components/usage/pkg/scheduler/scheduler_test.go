// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"github.com/robfig/cron"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestScheduler(t *testing.T) {
	firstRan := false
	secondRan := false
	s := New(
		JobSpec{
			Job: JobFunc(func() error {
				firstRan = true
				return nil
			}),
			ID:       "first",
			Schedule: cron.ConstantDelaySchedule{Delay: time.Second},
		},
		JobSpec{
			Job: JobFunc(func() error {
				secondRan = true
				return nil
			}),
			ID:       "second",
			Schedule: cron.ConstantDelaySchedule{Delay: time.Second},
		},
	)
	s.Start()
	time.Sleep(1 * time.Second)
	s.Stop()

	require.True(t, firstRan)
	require.True(t, secondRan)
}
