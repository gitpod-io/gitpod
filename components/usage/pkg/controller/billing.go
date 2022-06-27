// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"time"
)

type BillingController interface {
	Reconcile(ctx context.Context, now time.Time, report UsageReport)
}

type NoOpBillingController struct{}

func (b *NoOpBillingController) Reconcile(_ context.Context, _ time.Time, _ UsageReport) {}

type StripeBillingController struct {
	sc *stripe.Client
}

func NewStripeBillingController(sc *stripe.Client) *StripeBillingController {
	return &StripeBillingController{sc: sc}
}

func (b *StripeBillingController) Reconcile(ctx context.Context, now time.Time, report UsageReport) {
	runtimeReport := report.RuntimeSummaryForTeams(now)
	b.sc.UpdateUsage(runtimeReport)
}
