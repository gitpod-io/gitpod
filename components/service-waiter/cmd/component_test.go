// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd_test

import (
	"context"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/service-waiter/cmd"
)

var trueValue = "true"
var falseValue = "false"
var unknownValue = "unknown"

func Test_actualWaitFeatureFlag(t *testing.T) {
	baseDuration := time.Millisecond
	// use longer time if you want to debug
	// baseDuration := time.Second * 10
	cmd.FeatureSleepDuration = baseDuration * 20
	type args struct {
		timeoutDuration time.Duration
		values          []*string
		defaultValue    bool
		nilClient       bool
	}
	tests := []struct {
		name          string
		args          args
		wantFlagValue bool
		wantOk        bool
		fetchTimes    int
	}{
		{
			name: "happy path",
			args: args{
				timeoutDuration: baseDuration * 1000,
				values:          []*string{nil, nil, &trueValue},
				defaultValue:    false,
				nilClient:       false,
			},
			wantFlagValue: true,
			wantOk:        true,
			fetchTimes:    3,
		},
		{
			name: "happy path 2",
			args: args{
				timeoutDuration: baseDuration * 1000,
				values:          []*string{nil, nil, nil, &falseValue},
				defaultValue:    false,
				nilClient:       false,
			},
			wantFlagValue: false,
			wantOk:        true,
			fetchTimes:    4,
		},
		{
			name: "should keep wait even with unknown value",
			args: args{
				timeoutDuration: baseDuration * 1000,
				values:          []*string{nil, nil, nil, &unknownValue, &falseValue},
				defaultValue:    false,
				nilClient:       false,
			},
			wantFlagValue: false,
			wantOk:        true,
			fetchTimes:    5,
		},
		{
			name: "nil client goes to default value: false",
			args: args{
				timeoutDuration: baseDuration * 1000,
				values:          []*string{nil, nil, nil, &unknownValue, &falseValue},
				defaultValue:    false,
				nilClient:       true,
			},
			wantFlagValue: false,
			wantOk:        false,
			fetchTimes:    0,
		},
		{
			name: "nil client goes to default value: true",
			args: args{
				timeoutDuration: baseDuration * 1000,
				values:          []*string{nil, nil, nil, &unknownValue, &falseValue},
				defaultValue:    true,
				nilClient:       true,
			},
			wantFlagValue: true,
			wantOk:        false,
			fetchTimes:    0,
		},
		{
			name: "timed out with default value: true",
			args: args{
				timeoutDuration: baseDuration * 30,
				values:          []*string{nil, nil, nil, &unknownValue, &falseValue},
				defaultValue:    true,
				nilClient:       false,
			},
			wantFlagValue: true,
			wantOk:        false,
			fetchTimes:    2,
		},
		{
			name: "timed out with default value: false",
			args: args{
				timeoutDuration: baseDuration * 30,
				values:          []*string{nil, nil, nil, &unknownValue, &falseValue},
				defaultValue:    false,
				nilClient:       false,
			},
			wantFlagValue: false,
			wantOk:        false,
			fetchTimes:    2,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), tt.args.timeoutDuration)
			defer cancel()
			client := newMockClient(tt.args.values, tt.args.nilClient)
			gotFlagValue, gotOk, gotWaitTimes := cmd.ActualWaitFeatureFlag(ctx, client, tt.args.defaultValue)
			if gotFlagValue != tt.wantFlagValue {
				t.Errorf("actualWaitFeatureFlag() gotFlagValue = %v, want %v", gotFlagValue, tt.wantFlagValue)
			}
			if gotOk != tt.wantOk {
				t.Errorf("actualWaitFeatureFlag() gotOk = %v, want %v", gotOk, tt.wantOk)
			}
			if gotWaitTimes != tt.fetchTimes {
				t.Errorf("actualWaitFeatureFlag() gotWaitTimes = %v, want %v", gotWaitTimes, tt.fetchTimes)
			}
		})
	}
}

type mockClient struct {
	values []*string
	i      int
}

// GetBoolValue implements experiments.Client.
func (*mockClient) GetBoolValue(ctx context.Context, experimentName string, defaultValue bool, attributes experiments.Attributes) bool {
	panic("unimplemented")
}

// GetFloatValue implements experiments.Client.
func (*mockClient) GetFloatValue(ctx context.Context, experimentName string, defaultValue float64, attributes experiments.Attributes) float64 {
	panic("unimplemented")
}

// GetIntValue implements experiments.Client.
func (*mockClient) GetIntValue(ctx context.Context, experimentName string, defaultValue int, attributes experiments.Attributes) int {
	panic("unimplemented")
}

func newMockClient(values []*string, isNil bool) experiments.Client {
	if isNil {
		return nil
	}
	return &mockClient{values: values, i: 0}
}

// GetStringValue implements experiments.Client.
func (c *mockClient) GetStringValue(ctx context.Context, experimentName string, defaultValue string, attributes experiments.Attributes) string {
	defer func() {
		c.i += 1
	}()
	if c.i >= len(c.values) {
		return defaultValue
	}
	value := c.values[c.i]
	if value == nil {
		return defaultValue
	}
	return *value
}

var _ experiments.Client = &mockClient{}
