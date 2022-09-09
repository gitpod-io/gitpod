// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestLedgerJob_PreventsConcurrentInvocations(t *testing.T) {
	client := &fakeUsageClient{}
	job := NewLedgerTrigger(client, nil)

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

	require.Equal(t, 1, int(client.ReconcileUsageWithLedgerCallCount))
}

type fakeUsageClient struct {
	ReconcileUsageWithLedgerCallCount int32
}

// GetCostCenter retrieves the active cost center for the given attributionID
func (c *fakeUsageClient) GetCostCenter(ctx context.Context, in *v1.GetCostCenterRequest, opts ...grpc.CallOption) (*v1.GetCostCenterResponse, error) {
	return nil, status.Error(codes.Unauthenticated, "not implemented")
}

// SetCostCenter stores the given cost center
func (c *fakeUsageClient) SetCostCenter(ctx context.Context, in *v1.SetCostCenterRequest, opts ...grpc.CallOption) (*v1.SetCostCenterResponse, error) {
	return nil, status.Error(codes.Unauthenticated, "not implemented")
}

// Triggers reconciliation of usage with ledger implementation.
func (c *fakeUsageClient) ReconcileUsageWithLedger(ctx context.Context, in *v1.ReconcileUsageWithLedgerRequest, opts ...grpc.CallOption) (*v1.ReconcileUsageWithLedgerResponse, error) {
	atomic.AddInt32(&c.ReconcileUsageWithLedgerCallCount, 1)
	time.Sleep(1 * time.Second)

	return nil, status.Error(codes.Unauthenticated, "not implemented")
}

// ListUsage retrieves all usage for the specified attributionId and theb given time range
func (c *fakeUsageClient) ListUsage(ctx context.Context, in *v1.ListUsageRequest, opts ...grpc.CallOption) (*v1.ListUsageResponse, error) {
	return nil, status.Error(codes.Unauthenticated, "not implemented")
}
