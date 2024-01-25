// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package webhooks

import (
	"io"
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/billingservice"
	"github.com/sirupsen/logrus"
	"github.com/stripe/stripe-go/v72/webhook"
)

const maxBodyBytes = int64(65536)

const (
	InvoiceFinalizedEventType            = "invoice.finalized"
	CustomerSubscriptionDeletedEventType = "customer.subscription.deleted"
	ChargeDisputeCreatedEventType        = "charge.dispute.created"
	CustomerUpdatedEventType             = "customer.updated"
)

type webhookHandler struct {
	billingService         billingservice.Interface
	stripeWebhookSignature string
}

func NewStripeWebhookHandler(billingService billingservice.Interface, stripeWebhookSignature string) *webhookHandler {
	return &webhookHandler{
		billingService:         billingService,
		stripeWebhookSignature: stripeWebhookSignature,
	}
}

func (h *webhookHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		log.Errorf("Bad HTTP method: %s", req.Method)
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	stripeSignature := req.Header.Get("Stripe-Signature")
	if stripeSignature == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	req.Body = http.MaxBytesReader(w, req.Body, maxBodyBytes)

	payload, err := io.ReadAll(req.Body)
	if err != nil {
		log.WithError(err).Error("Failed to read payload body.")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// https://stripe.com/docs/webhooks/signatures#verify-official-libraries
	event, err := webhook.ConstructEvent(payload, stripeSignature, h.stripeWebhookSignature)
	if err != nil {
		log.WithError(err).Error("Failed to verify webhook signature.")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	logger := log.WithFields(logrus.Fields{"event": event.ID})

	switch event.Type {
	case InvoiceFinalizedEventType:
		logger.Info("Handling invoice finalization")
		invoiceID, ok := event.Data.Object["id"].(string)
		if !ok {
			logger.Error("failed to find invoice id in Stripe event payload")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		err = h.billingService.FinalizeInvoice(req.Context(), invoiceID)
		if err != nil {
			logger.WithError(err).Error("Failed to finalize invoice")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	case CustomerSubscriptionDeletedEventType:
		logger.Info("Handling subscription cancellation")
		subscriptionID, ok := event.Data.Object["id"].(string)
		if !ok {
			logger.Error("failed to find subscriptionId id in Stripe event payload")
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		err = h.billingService.CancelSubscription(req.Context(), subscriptionID)
		if err != nil {
			logger.WithError(err).Error("Failed to cancel subscription")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	case ChargeDisputeCreatedEventType:
		logger.Info("Handling charge dispute")
		disputeID, ok := event.Data.Object["id"].(string)
		if !ok {
			logger.Error("Failed to identify dispute ID from Stripe webhook.")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if err := h.billingService.OnChargeDispute(req.Context(), disputeID); err != nil {
			logger.WithError(err).Errorf("Failed to handle charge dispute event for dispute ID: %s", disputeID)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
	case CustomerUpdatedEventType:
		logger.Info("Handling CustomerUpdatedEventType")
		customerID, ok := event.Data.Object["id"].(string)
		if !ok {
			logger.Error("Failed to identify customer ID from Stripe webhook.")
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		previousAttributes, ok := event.Data.Object["previous_attributes"].(map[string]interface{})
		if !ok {
			logger.Error("Failed to find previousAttributes from Stripe webhook.")
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if _, ok := previousAttributes["address"]; ok {
			logger.Infof("Customer with ID %s address updated", customerID)

			err = h.billingService.UpdateCustomerSubscriptionsTaxState(req.Context(), customerID)
			if err != nil {
				logger.WithError(err).Error("Failed to cancel subscription")
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
		}
	default:
		logger.Errorf("Unexpected Stripe event type: %s", event.Type)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

}
