// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/bufbuild/connect-go"
	db "github.com/gitpod-io/gitpod/components/gitpod-db/go"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	experimental_v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	stripe_api "github.com/stripe/stripe-go/v72"
	"gopkg.in/dnaeon/go-vcr.v3/cassette"
	"gopkg.in/dnaeon/go-vcr.v3/recorder"
)

func TestBillingService_OnChargeDispute(t *testing.T) {
	r := NewStripeRecorder(t, "stripe_on_charge_dispute")

	client := r.GetDefaultClient()
	stripeClient, err := stripe.NewWithHTTPClient(stripe.ClientConfig{
		SecretKey: "testkey",
	}, client)
	require.NoError(t, err)

	stubUserService := &StubUserService{}
	svc := &BillingService{
		stripeClient: stripeClient,
		teamsService: &StubTeamsService{},
		userService:  stubUserService,
	}

	_, err = svc.OnChargeDispute(context.Background(), &v1.OnChargeDisputeRequest{
		DisputeId: "dp_1MrLJpAyBDPbWrhawbWHEIDL",
	})
	require.NoError(t, err)

	require.Equal(t, stubUserService.blockedUsers, []string{"owner_id"})
}

func NewStripeRecorder(t *testing.T, name string) *recorder.Recorder {
	t.Helper()

	r, err := recorder.New(fmt.Sprintf("fixtures/%s", name))
	require.NoError(t, err)

	t.Cleanup(func() {
		r.Stop()
	})

	// Add a hook which removes Authorization headers from all requests
	hook := func(i *cassette.Interaction) error {
		delete(i.Request.Headers, "Authorization")
		return nil
	}
	r.AddHook(hook, recorder.AfterCaptureHook)

	if r.Mode() != recorder.ModeRecordOnce {
		require.Fail(t, "Recorder should be in ModeRecordOnce")
	}

	return r
}

type StubTeamsService struct {
	v1connect.TeamsServiceClient
}

func (s *StubTeamsService) CreateTeam(context.Context, *connect.Request[experimental_v1.CreateTeamRequest]) (*connect.Response[experimental_v1.CreateTeamResponse], error) {
	return nil, nil
}

func (s *StubTeamsService) GetTeam(ctx context.Context, req *connect.Request[experimental_v1.GetTeamRequest]) (*connect.Response[experimental_v1.GetTeamResponse], error) {
	// generate a stub which returns a team
	team := &experimental_v1.Team{
		Id: req.Msg.GetTeamId(),
		Members: []*experimental_v1.TeamMember{
			{
				UserId: "owner_id",
				Role:   experimental_v1.TeamRole_TEAM_ROLE_OWNER,
			},
			{
				UserId: "non_owner_id",
				Role:   experimental_v1.TeamRole_TEAM_ROLE_MEMBER,
			},
		},
	}

	return connect.NewResponse(&experimental_v1.GetTeamResponse{
		Team: team,
	}), nil
}

func (s *StubTeamsService) ListTeams(context.Context, *connect.Request[experimental_v1.ListTeamsRequest]) (*connect.Response[experimental_v1.ListTeamsResponse], error) {
	return nil, nil
}
func (s *StubTeamsService) DeleteTeam(context.Context, *connect.Request[experimental_v1.DeleteTeamRequest]) (*connect.Response[experimental_v1.DeleteTeamResponse], error) {
	return nil, nil
}
func (s *StubTeamsService) JoinTeam(context.Context, *connect.Request[experimental_v1.JoinTeamRequest]) (*connect.Response[experimental_v1.JoinTeamResponse], error) {
	return nil, nil
}
func (s *StubTeamsService) ResetTeamInvitation(context.Context, *connect.Request[experimental_v1.ResetTeamInvitationRequest]) (*connect.Response[experimental_v1.ResetTeamInvitationResponse], error) {
	return nil, nil
}
func (s *StubTeamsService) UpdateTeamMember(context.Context, *connect.Request[experimental_v1.UpdateTeamMemberRequest]) (*connect.Response[experimental_v1.UpdateTeamMemberResponse], error) {
	return nil, nil
}
func (s *StubTeamsService) DeleteTeamMember(context.Context, *connect.Request[experimental_v1.DeleteTeamMemberRequest]) (*connect.Response[experimental_v1.DeleteTeamMemberResponse], error) {
	return nil, nil
}

type StubUserService struct {
	blockedUsers []string
}

func (s *StubUserService) GetAuthenticatedUser(context.Context, *connect.Request[experimental_v1.GetAuthenticatedUserRequest]) (*connect.Response[experimental_v1.GetAuthenticatedUserResponse], error) {
	return nil, nil
}

// ListSSHKeys lists the public SSH keys.
func (s *StubUserService) ListSSHKeys(context.Context, *connect.Request[experimental_v1.ListSSHKeysRequest]) (*connect.Response[experimental_v1.ListSSHKeysResponse], error) {
	return nil, nil
}

// CreateSSHKey adds a public SSH key.
func (s *StubUserService) CreateSSHKey(context.Context, *connect.Request[experimental_v1.CreateSSHKeyRequest]) (*connect.Response[experimental_v1.CreateSSHKeyResponse], error) {
	return nil, nil
}

// GetSSHKey retrieves an ssh key by ID.
func (s *StubUserService) GetSSHKey(context.Context, *connect.Request[experimental_v1.GetSSHKeyRequest]) (*connect.Response[experimental_v1.GetSSHKeyResponse], error) {
	return nil, nil
}

// DeleteSSHKey removes a public SSH key.
func (s *StubUserService) DeleteSSHKey(context.Context, *connect.Request[experimental_v1.DeleteSSHKeyRequest]) (*connect.Response[experimental_v1.DeleteSSHKeyResponse], error) {
	return nil, nil
}
func (s *StubUserService) GetGitToken(context.Context, *connect.Request[experimental_v1.GetGitTokenRequest]) (*connect.Response[experimental_v1.GetGitTokenResponse], error) {
	return nil, nil
}

func (s *StubUserService) GetSuggestedRepos(context.Context, *connect.Request[experimental_v1.GetSuggestedReposRequest]) (*connect.Response[experimental_v1.GetSuggestedReposResponse], error) {
	return nil, nil
}

func (s *StubUserService) BlockUser(ctx context.Context, req *connect.Request[experimental_v1.BlockUserRequest]) (*connect.Response[experimental_v1.BlockUserResponse], error) {
	s.blockedUsers = append(s.blockedUsers, req.Msg.GetUserId())
	return connect.NewResponse(&experimental_v1.BlockUserResponse{}), nil
}

func TestBalancesForStripeCostCenters(t *testing.T) {
	attributionIDForStripe := db.NewTeamAttributionID(uuid.New().String())
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
		"attributionId": "team:12345678-1234-1234-1234-123456789abc",
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
