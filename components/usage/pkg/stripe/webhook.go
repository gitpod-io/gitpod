// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package stripe

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/stripe/stripe-go/v72"
)

type WebhookHandler struct{}

func NewWebhookHandler() *WebhookHandler {
	return &WebhookHandler{}
}

func (h *WebhookHandler) Handle(w http.ResponseWriter, req *http.Request) {
	const maxBodyBytes = int64(65536)

	req.Body = http.MaxBytesReader(w, req.Body, maxBodyBytes)
	payload, err := ioutil.ReadAll(req.Body)
	if err != nil {
		log.WithError(err).Error("Stripe webhook error when reading request body")
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}

	event := stripe.Event{}
	if err := json.Unmarshal(payload, &event); err != nil {
		log.WithError(err).Error("Stripe webhook error while parsing event payload")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// TODO: verify webhook signature.
	// Conditional on there being a secret configured.

	fmt.Fprintf(w, "event type: %s", event.Type)
}
