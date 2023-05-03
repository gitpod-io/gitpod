// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis"
	"github.com/go-redsync/redsync/v4"
	"github.com/go-redsync/redsync/v4/redis/goredis"
	"github.com/stretchr/testify/require"
)

func TestWithRefreshingMutex(t *testing.T) {
	s := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: s.Addr()})

	pool := goredis.NewPool(client)
	rs := redsync.New(pool)

	invocationCount := int32(0)
	errCount := int32(0)
	okCount := int32(0)

	wg := sync.WaitGroup{}
	expiry := 2 * time.Second
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			err := WithRefreshingMutex(context.Background(), rs, "mutex-name", expiry, func(_ context.Context) error {
				atomic.AddInt32(&invocationCount, 1)
				time.Sleep(expiry + 1*time.Second)

				return nil
			})
			if err != nil {
				atomic.AddInt32(&errCount, 1)
			} else {
				atomic.AddInt32(&okCount, 1)
			}

		}()
	}

	wg.Wait()

	require.EqualValues(t, 1, invocationCount)
	require.EqualValues(t, 2, errCount)
	require.EqualValues(t, 1, okCount)
}
