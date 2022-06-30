// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"math"
	"time"
)

type BillingController interface {
	Reconcile(ctx context.Context, now time.Time, report UsageReport)
}

type NoOpBillingController struct{}

func (b *NoOpBillingController) Reconcile(_ context.Context, _ time.Time, _ UsageReport) {}

type StripeBillingController struct {
	pricer *WorkspacePricer
	sc     *stripe.Client
}

func NewStripeBillingController(sc *stripe.Client, pricer *WorkspacePricer) *StripeBillingController {
	return &StripeBillingController{
		sc:     sc,
		pricer: pricer,
	}
}

func (b *StripeBillingController) Reconcile(ctx context.Context, now time.Time, report UsageReport) {
	runtimeReport := report.CreditSummaryForTeams(b.pricer, now)
	b.sc.UpdateUsage(runtimeReport)
}

const (
	defaultWorkspaceClass = "default"
)

var (
	DefaultWorkspacePricer, _ = NewWorkspacePricer(map[string]float64{
		// 1 credit = 6 minutes
		"default": float64(1) / float64(6),
	})
)

func NewWorkspacePricer(creditMinutesByWorkspaceClass map[string]float64) (*WorkspacePricer, error) {
	if _, ok := creditMinutesByWorkspaceClass[defaultWorkspaceClass]; !ok {
		return nil, fmt.Errorf("credits per minute not defined for expected workspace class 'default'")
	}

	return &WorkspacePricer{creditMinutesByWorkspaceClass: creditMinutesByWorkspaceClass}, nil
}

type WorkspacePricer struct {
	creditMinutesByWorkspaceClass map[string]float64
}

func (p *WorkspacePricer) Credits(workspaceClass string, runtimeInSeconds int64) int64 {
	inMinutes := float64(runtimeInSeconds) / 60
	return int64(math.Ceil(p.CreditsPerMinuteForClass(workspaceClass) * inMinutes))
}

func (p *WorkspacePricer) CreditsPerMinuteForClass(workspaceClass string) float64 {
	if creditsForClass, ok := p.creditMinutesByWorkspaceClass[workspaceClass]; ok {
		return creditsForClass
	}
	return p.creditMinutesByWorkspaceClass[defaultWorkspaceClass]
}
