// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package webhooks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v72"
)

// https://stripe.com/docs/api/events/types
const (
	invoiceUpdatedEventType   = "invoice.updated"
	invoiceFinalizedEventType = "invoice.finalized"
	customerCreatedEventType  = "customer.created"
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
			ExpectedStatusCode: http.StatusBadRequest,
		},
		{
			HttpMethod:         http.MethodPut,
			ExpectedStatusCode: http.StatusBadRequest,
		},
	}

	srv := baseServerWithStripeWebhook(t)

	ev := stripe.Event{Type: invoiceFinalizedEventType}
	payload, err := json.Marshal(ev)
	require.NoError(t, err)

	url := fmt.Sprintf("%s%s", srv.HTTPAddress(), "/webhook")

	for _, scenario := range scenarios {
		t.Run(scenario.HttpMethod, func(t *testing.T) {
			req, err := http.NewRequest(scenario.HttpMethod, url, bytes.NewBuffer(payload))
			require.NoError(t, err)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)

			require.Equal(t, scenario.ExpectedStatusCode, resp.StatusCode)
		})
	}
}

func TestWebhookIgnoresIrrelevantEvents(t *testing.T) {
	scenarios := []struct {
		EventType          string
		ExpectedStatusCode int
	}{
		{
			EventType:          invoiceFinalizedEventType,
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
	}

	srv := baseServerWithStripeWebhook(t)

	url := fmt.Sprintf("%s%s", srv.HTTPAddress(), "/webhook")

	for _, scenario := range scenarios {
		t.Run(scenario.EventType, func(t *testing.T) {
			ev := stripe.Event{Type: scenario.EventType}
			payload, err := json.Marshal(ev)
			require.NoError(t, err)

			req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(payload))
			require.NoError(t, err)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)

			require.Equal(t, scenario.ExpectedStatusCode, resp.StatusCode)
		})
	}
}

func baseServerWithStripeWebhook(t *testing.T) *baseserver.Server {
	t.Helper()

	srv := baseserver.NewForTests(t,
		baseserver.WithHTTP(baseserver.MustUseRandomLocalAddress(t)),
	)
	baseserver.StartServerForTests(t, srv)

	srv.HTTPMux().Handle("/webhook", NewStripeWebhookHandler())

	return srv
}
