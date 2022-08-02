// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package webhooks

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/stripe/stripe-go/v72"
)

type webhookHandler struct{}

func NewStripeWebhookHandler() *webhookHandler {
	return &webhookHandler{}
}

func (h *webhookHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	const maxBodyBytes = int64(65536)

	req.Body = http.MaxBytesReader(w, req.Body, maxBodyBytes)

	event := stripe.Event{}
	err := json.NewDecoder(req.Body).Decode(&event)
	if err != nil {
		log.WithError(err).Error("Stripe webhook error while parsing event payload")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// TODO: verify webhook signature.
	// Conditional on there being a secret configured.

	fmt.Fprintf(w, "event type: %s", event.Type)
}
