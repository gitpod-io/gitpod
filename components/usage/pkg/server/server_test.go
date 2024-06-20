// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/go-redis/redis"
	"github.com/go-redsync/redsync/v4"
	"github.com/go-redsync/redsync/v4/redis/goredis"
	"google.golang.org/grpc"
)

// TEST_SCHEDULER=true go test -timeout 60s -run ^Test_startScheduler$ github.com/gitpod-io/gitpod/usage/pkg/server
func Test_startScheduler(t *testing.T) {
	if os.Getenv("TEST_SCHEDULER") != "true" {
		t.Skipf("Skipping test because TEST_SCHEDULER is not set to true")
	}

	s := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: s.Addr()})

	pool := goredis.NewPool(client)
	rs := redsync.New(pool)

	type args struct {
		name               string
		expHandler         func(exps *mockExps)
		expectUsageTimes   []int
		expectBillTImes    []int
		cfgTimeStringUsage string
		cfgTimeStringBill  string
		ctxTimeout         time.Duration
		tickerDuration     time.Duration
	}

	tests := []args{
		{
			name: "happy path no bill reset",
			expHandler: func(exps *mockExps) {
				exps.StringValue = "undefined"
			},
			expectUsageTimes: []int{1, 2, 3},
			expectBillTImes:  []int{0, 0, 0},
			// exec 3 times
			cfgTimeStringUsage: "3s",
			ctxTimeout:         10 * time.Second,
			tickerDuration:     3*time.Second + 100*time.Millisecond,
		},
		{
			name: "happy path with default values",
			expHandler: func(exps *mockExps) {
				exps.StringValue = "undefined"
			},
			expectUsageTimes: []int{1, 2, 3},
			expectBillTImes:  []int{0, 1, 2},
			// exec 3 times
			cfgTimeStringUsage: "3s",
			cfgTimeStringBill:  "4s",
			ctxTimeout:         10 * time.Second,
			tickerDuration:     3*time.Second + 100*time.Millisecond,
		},
		{
			name: "happy path with different values FF",
			expHandler: func(exps *mockExps) {
				<-time.After(time.Second * 2)
				exps.StringValue = "1s"
			},
			expectUsageTimes: []int{1, 2, 4, 6, 8, 10},
			expectBillTImes:  []int{0, 0, 0, 1, 1, 2},
			// exec 6 times
			cfgTimeStringUsage: "2s",
			cfgTimeStringBill:  "4s",
			ctxTimeout:         13 * time.Second,
			tickerDuration:     2*time.Second + 100*time.Millisecond,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockConfig := Config{
				LedgerSchedule:     tt.cfgTimeStringUsage,
				ResetUsageSchedule: tt.cfgTimeStringBill,
			}
			exps := mockExps{StringValue: "undefined"}
			usage := mockUsageService{}
			billing := mockBillService{}
			mockClients := func() (v1.UsageServiceClient, v1.BillingServiceClient, error) {
				return &usage, &billing, nil
			}
			go tt.expHandler(&exps)
			ctx, cancel := context.WithTimeout(context.Background(), tt.ctxTimeout)
			defer cancel()
			startScheduler(ctx, mockConfig, rs, mockClients)
			ticker := time.NewTicker(tt.tickerDuration)
			defer ticker.Stop()
			gotUsage := []int{}
			gotBill := []int{}
			for ctx.Err() == nil {
				select {
				case <-ticker.C:
					log.Infof(">> usage %d", usage.ReconcileUsageTimes)
					log.Infof(">> bill %d", usage.ResetUsageTimes)
					gotUsage = append(gotUsage, usage.ReconcileUsageTimes)
					gotBill = append(gotBill, usage.ResetUsageTimes)
				case <-ctx.Done():
					break
				}
			}
			if len(gotUsage) != len(tt.expectUsageTimes) {
				t.Errorf("%s expected ReconcileUsageTimes %v, got %v", tt.name, tt.expectUsageTimes, gotUsage)
				return
			}
			if len(gotBill) != len(tt.expectBillTImes) {
				t.Errorf("%s expected ResetUsageTimes %v, got %v", tt.name, tt.expectBillTImes, gotBill)
				return
			}
			for i, v := range tt.expectUsageTimes {
				if gotUsage[i] != v {
					t.Errorf("%s expected ReconcileUsageTimes %v, got %v", tt.name, tt.expectUsageTimes, gotUsage)
					break
				}
			}
			for i, v := range tt.expectBillTImes {
				if gotBill[i] != v {
					t.Errorf("%s expected ResetUsageTimes %v, got %v", tt.name, tt.expectBillTImes, gotBill)
					break
				}
			}
			log.Infof("test %s completed", tt.name)
		})
	}

}

type mockUsageService struct {
	ReconcileUsageTimes    int
	ReconcileUsageTimesArr []int
	ResetUsageTimes        int
}

var _ v1.UsageServiceClient = (*mockUsageService)(nil)

func (m *mockUsageService) AddUsageCreditNote(ctx context.Context, in *v1.AddUsageCreditNoteRequest, opts ...grpc.CallOption) (*v1.AddUsageCreditNoteResponse, error) {
	panic("unimplemented")
}

func (m *mockUsageService) GetBalance(ctx context.Context, in *v1.GetBalanceRequest, opts ...grpc.CallOption) (*v1.GetBalanceResponse, error) {
	panic("unimplemented")
}

func (m *mockUsageService) GetCostCenter(ctx context.Context, in *v1.GetCostCenterRequest, opts ...grpc.CallOption) (*v1.GetCostCenterResponse, error) {
	panic("unimplemented")
}

func (m *mockUsageService) ListUsage(ctx context.Context, in *v1.ListUsageRequest, opts ...grpc.CallOption) (*v1.ListUsageResponse, error) {
	panic("unimplemented")
}

func (m *mockUsageService) ReconcileUsage(ctx context.Context, in *v1.ReconcileUsageRequest, opts ...grpc.CallOption) (*v1.ReconcileUsageResponse, error) {
	log.Info("usage.ReconcileUsage")
	m.ReconcileUsageTimes++
	return &v1.ReconcileUsageResponse{}, nil
}

func (m *mockUsageService) ResetUsage(ctx context.Context, in *v1.ResetUsageRequest, opts ...grpc.CallOption) (*v1.ResetUsageResponse, error) {
	log.Info("usage.ResetUsage")
	m.ResetUsageTimes++
	return &v1.ResetUsageResponse{}, nil
}

func (m *mockUsageService) SetCostCenter(ctx context.Context, in *v1.SetCostCenterRequest, opts ...grpc.CallOption) (*v1.SetCostCenterResponse, error) {
	panic("unimplemented")
}

type mockBillService struct {
	ReconcileInvoicesTimes int
}

var _ v1.BillingServiceClient = (*mockBillService)(nil)

func (m *mockBillService) CancelSubscription(ctx context.Context, in *v1.CancelSubscriptionRequest, opts ...grpc.CallOption) (*v1.CancelSubscriptionResponse, error) {
	panic("unimplemented")
}

func (m *mockBillService) CreateHoldPaymentIntent(ctx context.Context, in *v1.CreateHoldPaymentIntentRequest, opts ...grpc.CallOption) (*v1.CreateHoldPaymentIntentResponse, error) {
	panic("unimplemented")
}

func (m *mockBillService) CreateStripeCustomer(ctx context.Context, in *v1.CreateStripeCustomerRequest, opts ...grpc.CallOption) (*v1.CreateStripeCustomerResponse, error) {
	panic("unimplemented")
}

func (m *mockBillService) CreateStripeSubscription(ctx context.Context, in *v1.CreateStripeSubscriptionRequest, opts ...grpc.CallOption) (*v1.CreateStripeSubscriptionResponse, error) {
	panic("unimplemented")
}

func (m *mockBillService) FinalizeInvoice(ctx context.Context, in *v1.FinalizeInvoiceRequest, opts ...grpc.CallOption) (*v1.FinalizeInvoiceResponse, error) {
	panic("unimplemented")
}

func (m *mockBillService) GetPriceInformation(ctx context.Context, in *v1.GetPriceInformationRequest, opts ...grpc.CallOption) (*v1.GetPriceInformationResponse, error) {
	panic("unimplemented")
}

func (m *mockBillService) GetStripeCustomer(ctx context.Context, in *v1.GetStripeCustomerRequest, opts ...grpc.CallOption) (*v1.GetStripeCustomerResponse, error) {
	panic("unimplemented")
}

func (m *mockBillService) OnChargeDispute(ctx context.Context, in *v1.OnChargeDisputeRequest, opts ...grpc.CallOption) (*v1.OnChargeDisputeResponse, error) {
	panic("unimplemented")
}

func (m *mockBillService) ReconcileInvoices(ctx context.Context, in *v1.ReconcileInvoicesRequest, opts ...grpc.CallOption) (*v1.ReconcileInvoicesResponse, error) {
	log.Info("bill.ReconcileInvoices")
	m.ReconcileInvoicesTimes++
	return &v1.ReconcileInvoicesResponse{}, nil
}

func (m *mockBillService) UpdateCustomerSubscriptionsTaxState(ctx context.Context, in *v1.UpdateCustomerSubscriptionsTaxStateRequest, opts ...grpc.CallOption) (*v1.UpdateCustomerSubscriptionsTaxStateResponse, error) {
	panic("unimplemented")
}

type mockExps struct {
	StringValue string
}

var _ experiments.Client = (*mockExps)(nil)

func (m *mockExps) GetBoolValue(ctx context.Context, experimentName string, defaultValue bool, attributes experiments.Attributes) bool {
	return defaultValue
}

func (m *mockExps) GetFloatValue(ctx context.Context, experimentName string, defaultValue float64, attributes experiments.Attributes) float64 {
	return defaultValue
}

func (m *mockExps) GetIntValue(ctx context.Context, experimentName string, defaultValue int, attributes experiments.Attributes) int {
	return defaultValue
}

func (m *mockExps) GetStringValue(ctx context.Context, experimentName string, defaultValue string, attributes experiments.Attributes) string {
	return m.StringValue
}
