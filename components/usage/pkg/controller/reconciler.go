// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
	"time"
)

type Reconciler interface {
	Reconcile() error
}

type ReconcilerFunc func() error

func (f ReconcilerFunc) Reconcile() error {
	return f()
}

func NewLedgerReconciler(usageClient v1.UsageServiceClient, billingClient v1.BillingServiceClient) *LedgerReconciler {
	return &LedgerReconciler{
		usageClient:   usageClient,
		billingClient: billingClient,
	}
}

type LedgerReconciler struct {
	usageClient   v1.UsageServiceClient
	billingClient v1.BillingServiceClient
}

func (r *LedgerReconciler) Reconcile() (err error) {
	ctx := context.Background()

	now := time.Now().UTC()
	hourAgo := now.Add(-1 * time.Hour)

	reportUsageReconcileStarted()
	defer func() {
		reportUsageReconcileFinished(time.Since(now), err)
	}()

	logger := log.
		WithField("from", hourAgo).
		WithField("to", now)

	logger.Info("Starting ledger reconciliation.")
	_, err = r.usageClient.ReconcileUsageWithLedger(ctx, &v1.ReconcileUsageWithLedgerRequest{
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
