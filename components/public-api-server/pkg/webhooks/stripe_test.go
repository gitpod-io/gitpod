// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package webhooks

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v72/webhook"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/billingservice"
	mockbillingservice "github.com/gitpod-io/gitpod/public-api-server/pkg/billingservice/mock_billingservice"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"
)

// https://stripe.com/docs/api/events/types
const (
	invoiceUpdatedEventType  = "invoice.updated"
	customerCreatedEventType = "customer.created"
)

const (
	testWebhookSecret = "whsec_random_secret"
)

func TestWebhookAcceptsPostRequests(t *testing.T) {
	scenarios := []struct {
		HttpMethod         string
		ExpectedStatusCode int
	}{
		{
			HttpMethod:         http.MethodPost,
			ExpectedStatusCode: http.StatusOK,
		},
		{
			HttpMethod:         http.MethodGet,
			ExpectedStatusCode: http.StatusMethodNotAllowed,
		},
		{
			HttpMethod:         http.MethodPut,
			ExpectedStatusCode: http.StatusMethodNotAllowed,
		},
	}

	srv := baseServerWithStripeWebhook(t, &billingservice.NoOpClient{})

	payload := payloadForStripeEvent(t, InvoiceFinalizedEventType)

	url := fmt.Sprintf("%s%s", srv.HTTPAddress(), "/webhook")

	for _, scenario := range scenarios {
		t.Run(scenario.HttpMethod, func(t *testing.T) {
			req, err := http.NewRequest(scenario.HttpMethod, url, bytes.NewReader(payload))
			require.NoError(t, err)

			req.Header.Set("Stripe-Signature", generateHeader(payload, testWebhookSecret))

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)

			require.Equal(t, scenario.ExpectedStatusCode, resp.StatusCode)
		})
	}
}

func TestWebhookIgnoresIrrelevantEvents_NoopClient(t *testing.T) {
	scenarios := []struct {
		EventType          string
		ExpectedStatusCode int
	}{
		{
			EventType:          InvoiceFinalizedEventType,
			ExpectedStatusCode: http.StatusOK,
		},
		{
			EventType:          CustomerSubscriptionDeletedEventType,
			ExpectedStatusCode: http.StatusOK,
		},
		{
			EventType:          invoiceUpdatedEventType,
			ExpectedStatusCode: http.StatusBadRequest,
		},
		{
			EventType:          customerCreatedEventType,
			ExpectedStatusCode: http.StatusBadRequest,
		},
		{
			EventType:          ChargeDisputeCreatedEventType,
			ExpectedStatusCode: http.StatusOK,
		},
	}

	srv := baseServerWithStripeWebhook(t, &billingservice.NoOpClient{})

	url := fmt.Sprintf("%s%s", srv.HTTPAddress(), "/webhook")

	for _, scenario := range scenarios {
		t.Run(scenario.EventType, func(t *testing.T) {
			payload := payloadForStripeEvent(t, scenario.EventType)

			req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
			require.NoError(t, err)

			req.Header.Set("Stripe-Signature", generateHeader(payload, testWebhookSecret))

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)

			require.Equal(t, scenario.ExpectedStatusCode, resp.StatusCode)
		})
	}
}

// TestWebhookInvokesFinalizeInvoiceRPC ensures that when the webhook is hit with a
// `invoice.finalized` event, the `FinalizeInvoice` method on the billing service is invoked
// with the invoice id from the event payload.
func TestWebhookInvokesFinalizeInvoiceRPC(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := mockbillingservice.NewMockInterface(ctrl)
	m.EXPECT().FinalizeInvoice(gomock.Any(), gomock.Eq("in_1LUQi7GadRXm50o36jWK7ehs"))

	srv := baseServerWithStripeWebhook(t, m)

	url := fmt.Sprintf("%s%s", srv.HTTPAddress(), "/webhook")

	payload := payloadForStripeEvent(t, InvoiceFinalizedEventType)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	require.NoError(t, err)

	req.Header.Set("Stripe-Signature", generateHeader(payload, testWebhookSecret))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestWebhookInvokesCancelSubscriptionRPC(t *testing.T) {
	ctrl := gomock.NewController(t)
	m := mockbillingservice.NewMockInterface(ctrl)
	m.EXPECT().CancelSubscription(gomock.Any(), gomock.Eq("in_1LUQi7GadRXm50o36jWK7ehs"))

	srv := baseServerWithStripeWebhook(t, m)

	url := fmt.Sprintf("%s%s", srv.HTTPAddress(), "/webhook")

	payload := payloadForStripeEvent(t, CustomerSubscriptionDeletedEventType)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	require.NoError(t, err)

	req.Header.Set("Stripe-Signature", generateHeader(payload, testWebhookSecret))

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func baseServerWithStripeWebhook(t *testing.T, billingService billingservice.Interface) *baseserver.Server {
	t.Helper()

	srv := baseserver.NewForTests(t,
		baseserver.WithHTTP(baseserver.MustUseRandomLocalAddress(t)),
	)
	baseserver.StartServerForTests(t, srv)

	srv.HTTPMux().Handle("/webhook", NewStripeWebhookHandler(billingService, testWebhookSecret))

	return srv
}

func payloadForStripeEvent(t *testing.T, eventType string) []byte {
	t.Helper()

	return []byte(`{
			"data": {
				"object": {
				  "id": "in_1LUQi7GadRXm50o36jWK7ehs"
				}
			  },
			  "type": "` + eventType + `"
		}`)
}

func generateHeader(payload []byte, secret string) string {
	now := time.Now()
	signature := webhook.ComputeSignature(now, payload, secret)
	return fmt.Sprintf("t=%d,%s=%s", now.Unix(), "v1", hex.EncodeToString(signature))
}
