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

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/go-redsync/redsync/v4"
	"github.com/go-redsync/redsync/v4/redis/goredis/v9"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

func TestWithRefreshingMutex(t *testing.T) {
	client := WithRedis(t)

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

			err := WithRefreshingMutex(rs, "mutex-name", expiry, func() error {
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

func WithRedis(t *testing.T) *redis.Client {
	t.Helper()

	ctx := context.Background()
	req := testcontainers.ContainerRequest{
		Image:        "redis:7.0.10",
		ExposedPorts: []string{"6379/tcp"},
		WaitingFor:   wait.ForLog("Ready to accept connections"),
	}
	redisC, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
		Logger:           log.Log.WithField("container", "redis"),
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		require.NoError(t, redisC.Terminate(ctx))
	})

	ip, err := redisC.Endpoint(ctx, "")
	require.NoError(t, err)

	client := redis.NewClient(&redis.Options{
		Addr: ip,
	})

	return client
}
