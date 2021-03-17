// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package resources_test

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/gitpod-io/gitpod/ws-daemon/pkg/resources"
)

func TestBucketLimiter(t *testing.T) {
	defaultBuckets := []resources.Bucket{
		{Budget: 50, Limit: 100},
		{Budget: 30, Limit: 50},
		{Budget: 20, Limit: 20},
		{Budget: 10, Limit: 5},
	}

	tests := []struct {
		Desc          string
		Buckets       []resources.Bucket
		BudgetSpent   int64
		ExpectedLimit int64
	}{
		{"empty bucket list", []resources.Bucket{}, 50, 0},
		{"in first bucket", defaultBuckets, 40, 100},
		{"in second bucket", defaultBuckets, 70, 50},
		{"in third bucket", defaultBuckets, 90, 20},
		{"in last bucket", defaultBuckets, 105, 5},
		{"beyond total budget", defaultBuckets, 200, 5},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			limit := resources.BucketLimiter(test.Buckets).Limit(test.BudgetSpent)
			if limit != test.ExpectedLimit {
				t.Errorf("unexpected limit %d: expected %d", limit, test.ExpectedLimit)
			}
		})
	}
}

func TestUnmarshalBucket(t *testing.T) {
	tests := []struct {
		Input       string
		Expectation resources.Bucket
	}{
		{`{"budget": 20, "limit": 50}`, resources.Bucket{Budget: 20, Limit: 50}},
	}

	for i, test := range tests {
		t.Run(fmt.Sprintf("%d", i), func(t *testing.T) {
			var act resources.Bucket
			err := json.Unmarshal([]byte(test.Input), &act)
			if err != nil {
				t.Error(err)
				return
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected bucket (-want +got):\n%s", diff)
			}
		})
	}
}
