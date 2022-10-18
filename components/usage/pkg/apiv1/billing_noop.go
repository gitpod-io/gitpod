// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
)

// BillingServiceNoop is used for Self-Hosted installations
type BillingServiceNoop struct {
	v1.UnimplementedBillingServiceServer
}

func (s *BillingServiceNoop) ReconcileInvoices(_ context.Context, _ *v1.ReconcileInvoicesRequest) (*v1.ReconcileInvoicesResponse, error) {
	log.Infof("ReconcileInvoices RPC invoked in no-op mode, no invoices will be updated.")
	return &v1.ReconcileInvoicesResponse{}, nil
}

func (s *BillingServiceNoop) CancelSubscription(ctx context.Context, in *v1.CancelSubscriptionRequest) (*v1.CancelSubscriptionResponse, error) {
	log.Infof("ReconcileInvoices RPC invoked in no-op mode, no invoices will be updated.")
	return &v1.CancelSubscriptionResponse{}, nil
}
