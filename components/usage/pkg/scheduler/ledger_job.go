// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/robfig/cron"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func NewLedgerTriggerJob(schedule time.Duration, job Job) (JobSpec, error) {
	parsed, err := cron.Parse(fmt.Sprintf("@every %s", schedule.String()))
	if err != nil {
		return JobSpec{}, fmt.Errorf("failed to parse period into schedule: %w", err)
	}

	return JobSpec{
		Job:                 job,
		ID:                  "ledger",
		Schedule:            parsed,
		InitialLockDuration: schedule,
	}, nil
}

type ClientsConstructor func() (v1.UsageServiceClient, v1.BillingServiceClient, error)

func NewLedgerTrigger(clientConstructor ClientsConstructor) *LedgerJob {
	return &LedgerJob{
		clientsConstructor: clientConstructor,
	}
}

type LedgerJob struct {
	clientsConstructor ClientsConstructor
}

func (r *LedgerJob) Run() (err error) {
	ctx := context.Background()
	now := time.Now().UTC()
	hourAgo := now.Add(-1 * time.Hour)

	defer func() {
		reportLedgerCompleted(err)
	}()

	logger := log.
		WithField("from", hourAgo).
		WithField("to", now)

	usageClient, billingClient, err := r.clientsConstructor()
	if err != nil {
		return fmt.Errorf("failed to construct usage and billing client: %w", err)
	}

	logger.Info("Running ledger job. Reconciling usage records.")
	_, err = usageClient.ReconcileUsage(ctx, &v1.ReconcileUsageRequest{
		From: timestamppb.New(hourAgo),
		To:   timestamppb.New(now),
	})
	if err != nil {
		logger.WithError(err).Errorf("Failed to reconcile usage with ledger.")
		return fmt.Errorf("failed to reconcile usage with ledger: %w", err)
	}

	logger.Info("Starting invoice reconciliation.")
	_, err = billingClient.ReconcileInvoices(ctx, &v1.ReconcileInvoicesRequest{})
	if err != nil {
		logger.WithError(err).Errorf("Failed to reconcile invoices.")
		return fmt.Errorf("failed to reconcile invoices: %w", err)
	}

	return nil
}
