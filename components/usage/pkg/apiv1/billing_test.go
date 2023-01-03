// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"encoding/json"
	"testing"

	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	stripe_api "github.com/stripe/stripe-go/v72"
)

func TestBalancesForStripeCostCenters(t *testing.T) {
	attributionIDForStripe := db.NewUserAttributionID(uuid.New().String())
	attributionIDForOther := db.NewTeamAttributionID(uuid.New().String())
	dbconn := dbtest.ConnectForTests(t)

	dbtest.CreateCostCenters(t, dbconn,
		dbtest.NewCostCenter(t, db.CostCenter{
			ID:              attributionIDForStripe,
			BillingStrategy: db.CostCenter_Stripe,
		}),
		dbtest.NewCostCenter(t, db.CostCenter{
			ID:              attributionIDForOther,
			BillingStrategy: db.CostCenter_Other,
		}),
	)

	balances := []db.Balance{
		{
			AttributionID: attributionIDForStripe,
			CreditCents:   100,
		},
		{
			AttributionID: attributionIDForOther,
			CreditCents:   100,
		},
	}

	stripeBalances, err := balancesForStripeCostCenters(context.Background(), db.NewCostCenterManager(dbconn, db.DefaultSpendingLimit{}), balances)
	require.NoError(t, err)
	require.Len(t, stripeBalances, 1)
	require.Equal(t, stripeBalances[0].AttributionID, attributionIDForStripe)
}

func TestFinalizeInvoiceForIndividual(t *testing.T) {
	invoice := stripe_api.Invoice{}
	require.NoError(t, json.Unmarshal([]byte(IndiInvoiceTestData), &invoice))
	usage, err := InternalComputeInvoiceUsage(context.Background(), &invoice)
	require.NoError(t, err)
	require.Equal(t, usage.CreditCents, db.CreditCents(-103100))
}

var IndiInvoiceTestData = `{
	"id": "in_1MA0RBAyBDPbWrhabNdJIuhl",
	"object": "invoice",
	"account_country": "DE",
	"account_name": "Gitpod GmbH",
	"account_tax_ids": null,
	"amount_due": 1012,
	"amount_paid": 1012,
	"amount_remaining": 0,
	"application": null,
	"application_fee_amount": null,
	"attempt_count": 1,
	"attempted": true,
	"auto_advance": false,
	"automatic_tax": {
	  "enabled": false,
	  "status": null
	},
	"billing_reason": "subscription_cycle",
	"charge": "ch_3MA1YjAyBDPbWrha1F1mqyQs",
	"collection_method": "charge_automatically",
	"created": 1669853737,
	"currency": "usd",
	"custom_fields": null,
	"customer": {
	  "id": "cus_MoA9ghwDcE2vaA",
	  "object": "customer",
	  "address": {
		"city": null,
		"country": "TW",
		"line1": "",
		"line2": null,
		"postal_code": null,
		"state": null
	  },
	  "balance": 0,
	  "created": 1668552088,
	  "currency": "usd",
	  "default_currency": "usd",
	  "default_source": null,
	  "delinquent": false,
	  "description": null,
	  "discount": null,
	  "email": "xxxxx@email.com",
	  "invoice_prefix": "89796AD3",
	  "invoice_settings": {
		"custom_fields": null,
		"default_payment_method": "pm_1M4XoqAyBDPbWrhaqEc29Ev0",
		"footer": null,
		"rendering_options": null
	  },
	  "livemode": false,
	  "metadata": {
		"attributionId": "user:12345678-1234-1234-1234-123456789abc",
		"preferredCurrency": "USD"
	  },
	  "name": "user-name",
	  "phone": null,
	  "preferred_locales": [],
	  "shipping": null,
	  "tax_exempt": "none",
	  "test_clock": null
	},
	"customer_address": {
	  "city": null,
	  "country": "TW",
	  "line1": "",
	  "line2": null,
	  "postal_code": null,
	  "state": null
	},
	"customer_email": "xxxxx@email.com",
	"customer_name": "user-name",
	"customer_phone": null,
	"customer_shipping": null,
	"customer_tax_exempt": "none",
	"customer_tax_ids": [],
	"default_payment_method": null,
	"default_source": null,
	"default_tax_rates": [],
	"description": null,
	"discount": null,
	"discounts": [],
	"due_date": null,
	"ending_balance": 0,
	"footer": null,
	"from_invoice": null,
	"hosted_invoice_url": "xxxx",
	"invoice_pdf": "xxxx",
	"last_finalization_error": null,
	"latest_revision": null,
	"lines": {
	  "object": "list",
	  "data": [
		{
		  "id": "il_1MA0RBAyBDPbWrhaMKGOYdcr",
		  "object": "line_item",
		  "amount": 0,
		  "amount_excluding_tax": 0,
		  "currency": "usd",
		  "description": "1000 credit × Gitpod Usage (Tier 1 at $0.00 / month)",
		  "discount_amounts": [],
		  "discountable": true,
		  "discounts": [],
		  "livemode": false,
		  "metadata": {},
		  "period": {
			"end": 1669852800,
			"start": 1668552093
		  },
		  "plan": {
			"id": "price_1LmYDQAyBDPbWrhaiebWlzVX",
			"object": "plan",
			"active": true,
			"aggregate_usage": "last_during_period",
			"amount": null,
			"amount_decimal": null,
			"billing_scheme": "tiered",
			"created": 1664263708,
			"currency": "usd",
			"interval": "month",
			"interval_count": 1,
			"livemode": false,
			"metadata": {},
			"nickname": "Individual USD",
			"product": "prod_MIUT2nUscrEWBA",
			"tiers_mode": "graduated",
			"transform_usage": null,
			"trial_period_days": null,
			"usage_type": "metered"
		  },
		  "price": {
			"id": "price_1LmYDQAyBDPbWrhaiebWlzVX",
			"object": "price",
			"active": true,
			"billing_scheme": "tiered",
			"created": 1664263708,
			"currency": "usd",
			"custom_unit_amount": null,
			"livemode": false,
			"lookup_key": null,
			"metadata": {},
			"nickname": "Individual USD",
			"product": "prod_MIUT2nUscrEWBA",
			"recurring": {
			  "aggregate_usage": "last_during_period",
			  "interval": "month",
			  "interval_count": 1,
			  "trial_period_days": null,
			  "usage_type": "metered"
			},
			"tax_behavior": "inclusive",
			"tiers_mode": "graduated",
			"transform_quantity": null,
			"type": "recurring",
			"unit_amount": null,
			"unit_amount_decimal": null
		  },
		  "proration": false,
		  "proration_details": {
			"credited_items": null
		  },
		  "quantity": 1000,
		  "subscription": "sub_1M4XovAyBDPbWrhaCnn4gigv",
		  "subscription_item": "si_MoA9zVoSS4gH2G",
		  "tax_amounts": [],
		  "tax_rates": [],
		  "type": "subscription",
		  "unit_amount_excluding_tax": "0"
		},
		{
		  "id": "il_1MA0RCAyBDPbWrhaogm8Cw8j",
		  "object": "line_item",
		  "amount": 900,
		  "amount_excluding_tax": 900,
		  "currency": "usd",
		  "description": "Gitpod Usage (Tier 1 at $9.00 / month)",
		  "discount_amounts": [],
		  "discountable": true,
		  "discounts": [],
		  "livemode": false,
		  "metadata": {},
		  "period": {
			"end": 1669852800,
			"start": 1668552093
		  },
		  "plan": {
			"id": "price_1LmYDQAyBDPbWrhaiebWlzVX",
			"object": "plan",
			"active": true,
			"aggregate_usage": "last_during_period",
			"amount": null,
			"amount_decimal": null,
			"billing_scheme": "tiered",
			"created": 1664263708,
			"currency": "usd",
			"interval": "month",
			"interval_count": 1,
			"livemode": false,
			"metadata": {},
			"nickname": "Individual USD",
			"product": "prod_MIUT2nUscrEWBA",
			"tiers_mode": "graduated",
			"transform_usage": null,
			"trial_period_days": null,
			"usage_type": "metered"
		  },
		  "price": {
			"id": "price_1LmYDQAyBDPbWrhaiebWlzVX",
			"object": "price",
			"active": true,
			"billing_scheme": "tiered",
			"created": 1664263708,
			"currency": "usd",
			"custom_unit_amount": null,
			"livemode": false,
			"lookup_key": null,
			"metadata": {},
			"nickname": "Individual USD",
			"product": "prod_MIUT2nUscrEWBA",
			"recurring": {
			  "aggregate_usage": "last_during_period",
			  "interval": "month",
			  "interval_count": 1,
			  "trial_period_days": null,
			  "usage_type": "metered"
			},
			"tax_behavior": "inclusive",
			"tiers_mode": "graduated",
			"transform_quantity": null,
			"type": "recurring",
			"unit_amount": null,
			"unit_amount_decimal": null
		  },
		  "proration": false,
		  "proration_details": {
			"credited_items": null
		  },
		  "quantity": 0,
		  "subscription": "sub_1M4XovAyBDPbWrhaCnn4gigv",
		  "subscription_item": "si_MoA9zVoSS4gH2G",
		  "tax_amounts": [],
		  "tax_rates": [],
		  "type": "subscription",
		  "unit_amount_excluding_tax": null
		},
		{
		  "id": "il_1MA0RDAyBDPbWrhaIF5LaBhx",
		  "object": "line_item",
		  "amount": 112,
		  "amount_excluding_tax": 112,
		  "currency": "usd",
		  "description": "31 credit × Gitpod Usage (Tier 2 at $0.036 / month)",
		  "discount_amounts": [],
		  "discountable": true,
		  "discounts": [],
		  "livemode": false,
		  "metadata": {},
		  "period": {
			"end": 1669852800,
			"start": 1668552093
		  },
		  "plan": {
			"id": "price_1LmYDQAyBDPbWrhaiebWlzVX",
			"object": "plan",
			"active": true,
			"aggregate_usage": "last_during_period",
			"amount": null,
			"amount_decimal": null,
			"billing_scheme": "tiered",
			"created": 1664263708,
			"currency": "usd",
			"interval": "month",
			"interval_count": 1,
			"livemode": false,
			"metadata": {},
			"nickname": "Individual USD",
			"product": "prod_MIUT2nUscrEWBA",
			"tiers_mode": "graduated",
			"transform_usage": null,
			"trial_period_days": null,
			"usage_type": "metered"
		  },
		  "price": {
			"id": "price_1LmYDQAyBDPbWrhaiebWlzVX",
			"object": "price",
			"active": true,
			"billing_scheme": "tiered",
			"created": 1664263708,
			"currency": "usd",
			"custom_unit_amount": null,
			"livemode": false,
			"lookup_key": null,
			"metadata": {},
			"nickname": "Individual USD",
			"product": "prod_MIUT2nUscrEWBA",
			"recurring": {
			  "aggregate_usage": "last_during_period",
			  "interval": "month",
			  "interval_count": 1,
			  "trial_period_days": null,
			  "usage_type": "metered"
			},
			"tax_behavior": "inclusive",
			"tiers_mode": "graduated",
			"transform_quantity": null,
			"type": "recurring",
			"unit_amount": null,
			"unit_amount_decimal": null
		  },
		  "proration": false,
		  "proration_details": {
			"credited_items": null
		  },
		  "quantity": 31,
		  "subscription": "sub_1M4XovAyBDPbWrhaCnn4gigv",
		  "subscription_item": "si_MoA9zVoSS4gH2G",
		  "tax_amounts": [],
		  "tax_rates": [],
		  "type": "subscription",
		  "unit_amount_excluding_tax": "4"
		},
		{
		  "id": "il_1MA0REAyBDPbWrhaMRhZhiJ6",
		  "object": "line_item",
		  "amount": 0,
		  "amount_excluding_tax": 0,
		  "currency": "usd",
		  "description": "Gitpod Usage (Tier 2 at $0.00 / month)",
		  "discount_amounts": [],
		  "discountable": true,
		  "discounts": [],
		  "livemode": false,
		  "metadata": {},
		  "period": {
			"end": 1669852800,
			"start": 1668552093
		  },
		  "plan": {
			"id": "price_1LmYDQAyBDPbWrhaiebWlzVX",
			"object": "plan",
			"active": true,
			"aggregate_usage": "last_during_period",
			"amount": null,
			"amount_decimal": null,
			"billing_scheme": "tiered",
			"created": 1664263708,
			"currency": "usd",
			"interval": "month",
			"interval_count": 1,
			"livemode": false,
			"metadata": {},
			"nickname": "Individual USD",
			"product": "prod_MIUT2nUscrEWBA",
			"tiers_mode": "graduated",
			"transform_usage": null,
			"trial_period_days": null,
			"usage_type": "metered"
		  },
		  "price": {
			"id": "price_1LmYDQAyBDPbWrhaiebWlzVX",
			"object": "price",
			"active": true,
			"billing_scheme": "tiered",
			"created": 1664263708,
			"currency": "usd",
			"custom_unit_amount": null,
			"livemode": false,
			"lookup_key": null,
			"metadata": {},
			"nickname": "Individual USD",
			"product": "prod_MIUT2nUscrEWBA",
			"recurring": {
			  "aggregate_usage": "last_during_period",
			  "interval": "month",
			  "interval_count": 1,
			  "trial_period_days": null,
			  "usage_type": "metered"
			},
			"tax_behavior": "inclusive",
			"tiers_mode": "graduated",
			"transform_quantity": null,
			"type": "recurring",
			"unit_amount": null,
			"unit_amount_decimal": null
		  },
		  "proration": false,
		  "proration_details": {
			"credited_items": null
		  },
		  "quantity": 0,
		  "subscription": "sub_1M4XovAyBDPbWrhaCnn4gigv",
		  "subscription_item": "si_MoA9zVoSS4gH2G",
		  "tax_amounts": [],
		  "tax_rates": [],
		  "type": "subscription",
		  "unit_amount_excluding_tax": null
		}
	  ],
	  "has_more": false,
	  "total_count": 4,
	  "url": "/v1/invoices/in_1MA0RBAyBDPbWrhabNdJIuhl/lines"
	},
	"livemode": false,
	"metadata": {},
	"next_payment_attempt": null,
	"number": "DF67D6F2-0037",
	"on_behalf_of": null,
	"paid": true,
	"paid_out_of_band": false,
	"payment_intent": "pi_3MA1YjAyBDPbWrha1Tb6pdTW",
	"payment_settings": {
	  "default_mandate": null,
	  "payment_method_options": null,
	  "payment_method_types": [
		"card",
		"link"
	  ]
	},
	"period_end": 1669852800,
	"period_start": 1668552093,
	"post_payment_credit_notes_amount": 0,
	"pre_payment_credit_notes_amount": 0,
	"quote": null,
	"receipt_number": "2061-6831",
	"rendering_options": null,
	"starting_balance": 0,
	"statement_descriptor": null,
	"status": "paid",
	"status_transitions": {
	  "finalized_at": 1669858049,
	  "marked_uncollectible_at": null,
	  "paid_at": 1669948594,
	  "voided_at": null
	},
	"subscription": "sub_1M4XovAyBDPbWrhaCnn4gigv",
	"subtotal": 1012,
	"subtotal_excluding_tax": 1012,
	"tax": null,
	"test_clock": null,
	"total": 1012,
	"total_discount_amounts": [],
	"total_excluding_tax": 1012,
	"total_tax_amounts": [],
	"transfer_data": null,
	"webhooks_delivered_at": 1669853737
  }`
