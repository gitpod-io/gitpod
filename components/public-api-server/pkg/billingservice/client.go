// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package billingservice

import (
	"context"
	"fmt"

	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

//go:generate mockgen -source=client.go Interface -destination=./mock_billingservice/billingservice.go > mock_billingservice/billingservice.go

type Interface interface {
	FinalizeInvoice(ctx context.Context, invoiceId string) error
	CancelSubscription(ctx context.Context, subscriptionId string) error
	OnChargeDispute(ctx context.Context, disputeID string) error
}

type Client struct {
	b v1.BillingServiceClient
}

func New(billingServiceAddress string) (*Client, error) {
	conn, err := grpc.Dial(billingServiceAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to dial billing service gRPC server: %w", err)
	}

	return &Client{b: v1.NewBillingServiceClient(conn)}, nil
}

func (c *Client) FinalizeInvoice(ctx context.Context, invoiceId string) error {
	_, err := c.b.FinalizeInvoice(ctx, &v1.FinalizeInvoiceRequest{InvoiceId: invoiceId})
	if err != nil {
		return fmt.Errorf("failed RPC to billing service: %s", err)
	}

	return nil
}

func (c *Client) CancelSubscription(ctx context.Context, subscriptionId string) error {
	_, err := c.b.CancelSubscription(ctx, &v1.CancelSubscriptionRequest{SubscriptionId: subscriptionId})
	if err != nil {
		return fmt.Errorf("failed RPC to billing service: %s", err)
	}

	return nil
}

func (c *Client) OnChargeDispute(ctx context.Context, disputeID string) error {
	_, err := c.b.OnChargeDispute(ctx, &v1.OnChargeDisputeRequest{
		DisputeId: disputeID,
	})
	if err != nil {
		return fmt.Errorf("failed RPC to billing service: %s", err)
	}

	return nil
}
