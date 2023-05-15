// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis"
	"github.com/go-redsync/redsync/v4"
	"github.com/go-redsync/redsync/v4/redis/goredis"
	"github.com/robfig/cron"
	"github.com/stretchr/testify/require"
)

func TestScheduler_StopsAll(t *testing.T) {
	red := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: red.Addr()})

	pool := goredis.NewPool(client)
	rs := redsync.New(pool)

	firstRan := false
	secondRan := false
	s := New(
		rs,
		JobSpec{
			Job: JobFunc(func() error {
				firstRan = true
				return nil
			}),
			ID:                  "first",
			Schedule:            cron.ConstantDelaySchedule{Delay: time.Second},
			InitialLockDuration: time.Second,
		},
		JobSpec{
			Job: JobFunc(func() error {
				secondRan = true
				return nil
			}),
			ID:                  "second",
			Schedule:            cron.ConstantDelaySchedule{Delay: time.Second},
			InitialLockDuration: time.Second,
		},
	)
	s.Start()
	time.Sleep(1 * time.Second)
	s.Stop()

	require.True(t, firstRan)
	require.True(t, secondRan)
}
