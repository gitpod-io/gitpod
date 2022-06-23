// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import "github.com/gitpod-io/gitpod/usage/pkg/stripe"

type BillingController interface {
	Reconcile(report []TeamUsage)
}

type NoOpBillingController struct{}
type StripeBillingController struct{}

func (b *NoOpBillingController) Reconcile(report []TeamUsage) {}

func (b *StripeBillingController) Reconcile(report []TeamUsage) {
	// Convert the usage report to sum all entries for the same team.
	var summedReport = make(map[string]int64)
	for _, usageEntry := range report {
		summedReport[usageEntry.TeamID] += usageEntry.WorkspaceSeconds
	}

	stripe.UpdateUsage(summedReport)
}
