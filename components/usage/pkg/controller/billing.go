// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import "github.com/gitpod-io/gitpod/usage/pkg/stripe"

type BillingController interface {
	Reconcile(report []TeamUsage)
}

type NoOpBillingController struct{}

func (b *NoOpBillingController) Reconcile(report []TeamUsage) {}

type StripeBillingController struct {
	sc *stripe.Client
}

func NewStripeBillingController(sc *stripe.Client) *StripeBillingController {
	return &StripeBillingController{sc: sc}
}

func (b *StripeBillingController) Reconcile(report []TeamUsage) {
	// Convert the usage report to sum all entries for the same team.
	var summedReport = make(map[string]int64)
	for _, usageEntry := range report {
		summedReport[usageEntry.TeamID] += usageEntry.WorkspaceSeconds
	}

	b.sc.UpdateUsage(summedReport)
}
