// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"fmt"
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

func NewUsageAndBillingReconciler(usageClient v1.UsageServiceClient, billingClient v1.BillingServiceClient) *UsageAndBillingReconciler {
	return &UsageAndBillingReconciler{
		nowFunc:       time.Now,
		usageClient:   usageClient,
		billingClient: billingClient,
	}
}

type UsageAndBillingReconciler struct {
	nowFunc func() time.Time

	usageClient   v1.UsageServiceClient
	billingClient v1.BillingServiceClient
}

func (r *UsageAndBillingReconciler) Reconcile() (err error) {
	ctx := context.Background()
	now := r.nowFunc().UTC()

	reportUsageReconcileStarted()
	defer func() {
		reportUsageReconcileFinished(time.Since(now), err)
	}()

	startOfCurrentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	startOfNextMonth := startOfCurrentMonth.AddDate(0, 1, 0)

	usageResp, err := r.usageClient.ReconcileUsage(ctx, &v1.ReconcileUsageRequest{
		StartTime: timestamppb.New(startOfCurrentMonth),
		EndTime:   timestamppb.New(startOfNextMonth),
	})
	if err != nil {
		return fmt.Errorf("failed to reconcile usage: %w", err)
	}

	sessions := usageResp.GetSessions()

	_, err = r.billingClient.UpdateInvoices(ctx, &v1.UpdateInvoicesRequest{
		StartTime: timestamppb.New(startOfCurrentMonth),
		EndTime:   timestamppb.New(startOfNextMonth),
		Sessions:  sessions,
	})
	if err != nil {
		return fmt.Errorf("failed to update invoices: %w", err)
	}

	return nil
}
