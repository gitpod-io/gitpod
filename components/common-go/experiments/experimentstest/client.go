// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experimentstest

import (
	"context"

	"github.com/gitpod-io/gitpod/common-go/experiments"
)

type Client struct {
	BoolMatcher   func(ctx context.Context, experiment string, defaultValue bool, attributes experiments.Attributes) bool
	IntMatcher    func(ctx context.Context, experimentName string, defaultValue int, attributes experiments.Attributes) int
	FloatMatcher  func(ctx context.Context, experimentName string, defaultValue float64, attributes experiments.Attributes) float64
	StringMatcher func(ctx context.Context, experimentName string, defaultValue string, attributes experiments.Attributes) string
}

func (c *Client) GetBoolValue(ctx context.Context, experimentName string, defaultValue bool, attributes experiments.Attributes) bool {
	if c.BoolMatcher == nil {
		return defaultValue
	}
	return c.BoolMatcher(ctx, experimentName, defaultValue, attributes)
}
func (c *Client) GetIntValue(ctx context.Context, experimentName string, defaultValue int, attributes experiments.Attributes) int {
	if c.IntMatcher == nil {
		return defaultValue
	}
	return c.IntMatcher(ctx, experimentName, defaultValue, attributes)
}
func (c *Client) GetFloatValue(ctx context.Context, experimentName string, defaultValue float64, attributes experiments.Attributes) float64 {
	if c.FloatMatcher == nil {
		return defaultValue
	}
	return c.FloatMatcher(ctx, experimentName, defaultValue, attributes)
}
func (c *Client) GetStringValue(ctx context.Context, experimentName string, defaultValue string, attributes experiments.Attributes) string {
	if c.StringMatcher == nil {
		return defaultValue
	}
	return c.StringMatcher(ctx, experimentName, defaultValue, attributes)
}
