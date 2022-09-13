// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package scheduler

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/robfig/cron"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
	"time"
)

type Job interface {
	Run() error
}

type JobFunc func() error

func (f JobFunc) Run() error {
	return f()
}

func NewPeriodicJobSpec(period time.Duration, id string, job Job) (JobSpec, error) {
	parsed, err := cron.Parse(fmt.Sprintf("@every %s", period.String()))
	if err != nil {
		return JobSpec{}, fmt.Errorf("failed to parse period into schedule: %w", err)
	}

	return JobSpec{
		Job:      WithoutConcurrentRun(job),
		ID:       id,
		Schedule: parsed,
	}, nil
}

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

// WithoutConcurrentRun wraps a Job and ensures the job does not concurrently
func WithoutConcurrentRun(j Job) Job {
	return &preventConcurrentInvocation{
		job:     j,
		running: make(chan struct{}, 1),
	}
}

type preventConcurrentInvocation struct {
	job     Job
	running chan struct{}
}

func (r *preventConcurrentInvocation) Run() error {
	select {
	// attempt a write to signal we want to run
	case r.running <- struct{}{}:
		// we managed to write, there's no other job executing. Cases are not fall through so we continue executing our main logic.
		defer func() {
			// signal job completed
			<-r.running
		}()

		err := r.job.Run()
		return err
	default:
		// we could not write, so another instance is already running. Skip current run.
		log.Infof("Job already running, skipping invocation.")
		return nil
	}
}

func NewStoppedWithoutStoppingTimeDetectorSpec(dbconn *gorm.DB) *StoppedWithoutStoppingTimeDetector {
	return &StoppedWithoutStoppingTimeDetector{
		dbconn: dbconn,
	}
}

type StoppedWithoutStoppingTimeDetector struct {
	dbconn *gorm.DB
}

func (r *StoppedWithoutStoppingTimeDetector) Run() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	log.Info("Checking for instances which are stopped but are missing a stoppingTime.")
	instances, err := db.ListWorkspaceInstanceIDsWithPhaseStoppedButNoStoppingTime(ctx, r.dbconn)
	if err != nil {
		log.WithError(err).Errorf("Failed to list stop instances without stopping time.")
		return fmt.Errorf("failed to list instances from db: %w", err)
	}

	log.Infof("Identified %d instances in stopped state without a stopping time.", len(instances))
	stoppedWithoutStoppingTime.Set(float64(len(instances)))

	return nil
}
