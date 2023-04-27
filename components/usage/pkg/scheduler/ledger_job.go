// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/go-redsync/redsync/v4"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func NewLedgerTriggerJobSpec(schedule time.Duration, job Job) (JobSpec, error) {
	return NewPeriodicJobSpec(schedule, "ledger", job)
}

func NewLedgerTrigger(usageClient v1.UsageServiceClient, billingClient v1.BillingServiceClient, sync *redsync.Redsync, mutexExpiry time.Duration) *LedgerJob {
	return &LedgerJob{
		usageClient:   usageClient,
		billingClient: billingClient,
		sync:          sync,
		mutexDuration: mutexExpiry,
	}
}

type LedgerJob struct {
	sync *redsync.Redsync

	// mutexDuration configures for how a mutex on the ledger should hold initially
	// it will be automatically extend for this duration if the job does not complete
	// within the initial alloted time period
	mutexDuration time.Duration

	usageClient   v1.UsageServiceClient
	billingClient v1.BillingServiceClient
}

func (r *LedgerJob) Run() (err error) {
	ctx := context.Background()
	now := time.Now().UTC()
	hourAgo := now.Add(-1 * time.Hour)

	logger := log.
		WithField("from", hourAgo).
		WithField("to", now)

	runErr := WithRefreshingMutex(r.sync, "usage-ledger", r.mutexDuration, func() error {

		logger.Info("Running ledger job. Reconciling usage records.")
		_, err = r.usageClient.ReconcileUsage(ctx, &v1.ReconcileUsageRequest{
			From: timestamppb.New(hourAgo),
			To:   timestamppb.New(now),
		})
		if err != nil {
			logger.WithError(err).Errorf("Failed to reconcile usage with ledger.")
			return fmt.Errorf("failed to reconcile usage with ledger: %w", err)
		}

		logger.Info("Starting invoice reconciliation.")
		_, err = r.billingClient.ReconcileInvoices(ctx, &v1.ReconcileInvoicesRequest{})
		if err != nil {
			logger.WithError(err).Errorf("Failed to reconcile invoices.")
			return fmt.Errorf("failed to reconcile invoices: %w", err)
		}

		return nil
	})

	if errors.Is(runErr, redsync.ErrFailed) {
		logger.Info("Ledger job did not acquire mutex, another job must be running already.")
		return nil
	}

	defer func() {
		reportLedgerCompleted(runErr)
	}()

	return runErr

}
