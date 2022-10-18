// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experiments

import "context"

var _ Client = (*alwaysReturningDefaultValueClient)(nil)

type alwaysReturningDefaultValueClient struct{}

func NewAlwaysReturningDefaultValueClient() Client {
	return &alwaysReturningDefaultValueClient{}
}

func (c *alwaysReturningDefaultValueClient) GetBoolValue(_ context.Context, _ string, defaultValue bool, _ Attributes) bool {
	return defaultValue
}

func (c *alwaysReturningDefaultValueClient) GetIntValue(_ context.Context, _ string, defaultValue int, _ Attributes) int {
	return defaultValue
}

func (c *alwaysReturningDefaultValueClient) GetFloatValue(_ context.Context, _ string, defaultValue float64, _ Attributes) float64 {
	return defaultValue
}

func (c *alwaysReturningDefaultValueClient) GetStringValue(_ context.Context, _ string, defaultValue string, _ Attributes) string {
	return defaultValue
}
