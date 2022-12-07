// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
	"time"
)

func NewLedgerTriggerJobSpec(schedule time.Duration, job Job) (JobSpec, error) {
	return NewPeriodicJobSpec(schedule, "ledger", WithoutConcurrentRun(job))
}

func NewLedgerTrigger(usageClient v1.UsageServiceClient, billingClient v1.BillingServiceClient) *LedgerJob {
	return &LedgerJob{
		usageClient:   usageClient,
		billingClient: billingClient,
	}
}

type LedgerJob struct {
	usageClient   v1.UsageServiceClient
	billingClient v1.BillingServiceClient
}

func (r *LedgerJob) Run() (err error) {
	defer func() {
		reportLedgerCompleted(err)
	}()

	ctx := context.Background()
	now := time.Now().UTC()
	hourAgo := now.Add(-1 * time.Hour)

	logger := log.
		WithField("from", hourAgo).
		WithField("to", now)

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
}
