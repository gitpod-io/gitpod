// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package billingservice

import "context"

type NoOpClient struct{}

func (c *NoOpClient) FinalizeInvoice(ctx context.Context, invoiceId string) error {
	return nil
}

func (c *NoOpClient) CancelSubscription(ctx context.Context, subscriptionId string) error {
	return nil
}

func (c *NoOpClient) OnChargeDispute(ctx context.Context, disputeID string) error {
	return nil
}

func (c *NoOpClient) UpdateCustomerSubscriptionsTaxState(ctx context.Context, customerID string) error {
	return nil
}
