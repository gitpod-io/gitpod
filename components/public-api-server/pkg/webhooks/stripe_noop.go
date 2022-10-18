// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package webhooks

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"net/http"
)

func NewNoopWebhookHandler() *noopWebhookHandler {
	return &noopWebhookHandler{}
}

type noopWebhookHandler struct{}

func (h *noopWebhookHandler) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	log.Info("Received Stripe webhook handler, but running in no-op mode so will not be handing it.")
	w.WriteHeader(http.StatusNotImplemented)
}
