// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/robfig/cron"
	"google.golang.org/protobuf/types/known/timestamppb"
	"time"
)

type Job interface {
	Run() error
}

func NewLedgerTriggerJobSpec(schedule time.Duration, job Job) (JobSpec, error) {
	parsed, err := cron.Parse(fmt.Sprintf("@every %s", schedule.String()))
	if err != nil {
		return JobSpec{}, fmt.Errorf("failed to parse ledger job schedule: %w", err)
	}

	return JobSpec{
		Job:      job,
		ID:       "ledger",
		Schedule: parsed,
	}, nil
}

func NewLedgerTrigger(usageClient v1.UsageServiceClient, billingClient v1.BillingServiceClient) *LedgerJob {
	return &LedgerJob{
		usageClient:   usageClient,
		billingClient: billingClient,

		running: make(chan struct{}, 1),
	}
}

type LedgerJob struct {
	usageClient   v1.UsageServiceClient
	billingClient v1.BillingServiceClient

	running chan struct{}
}

func (r *LedgerJob) Run() (err error) {
	ctx := context.Background()

	select {
	// attempt a write to signal we want to run
	case r.running <- struct{}{}:
		// we managed to write, there's no other job executing. Cases are not fall through so we continue executing our main logic.
		defer func() {
			// signal job completed
			<-r.running
		}()
	default:
		// we could not write, so another instance is already running. Skip current run.
		log.Infof("Skipping ledger run, another run is already in progress.")
		return nil
	}

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
