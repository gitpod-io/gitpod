// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package metrics

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"

	dto "github.com/prometheus/client_model/go"
)

func TestAggregatedHistograms(t *testing.T) {
	labelName := "grpc_method"
	lowBound := .005
	midBound := .01
	highBound := .025
	agg := NewAggregatedHistograms(
		"grpc_server_handling_seconds",
		"help",
		[]string{labelName},
		[]float64{lowBound, midBound, highBound},
	)
	labelValue := "foo"
	var count uint64 = 1
	sum := 0.004
	var lowCount uint64 = 1
	var midCount uint64 = 1
	var highCount uint64 = 1
	assertDiff := func() string {
		var actual []*dto.Metric
		for _, m := range agg.collect() {
			dto := &dto.Metric{}
			err := m.Write(dto)
			if err != nil {
				t.Fatal(err)
			}
			actual = append(actual, dto)
		}

		return cmp.Diff([]*dto.Metric{{
			Label: []*dto.LabelPair{{
				Name:  &labelName,
				Value: &labelValue,
			}},
			Histogram: &dto.Histogram{
				SampleCount: &count,
				SampleSum:   &sum,
				Bucket: []*dto.Bucket{
					{CumulativeCount: &lowCount, UpperBound: &lowBound},
					{CumulativeCount: &midCount, UpperBound: &midBound},
					{CumulativeCount: &highCount, UpperBound: &highBound},
				},
			},
		}}, actual, cmpopts.IgnoreUnexported(dto.Metric{}, dto.LabelPair{}, dto.Histogram{}, dto.Bucket{}))
	}

	_ = agg.Add([]string{"foo"}, 1, 0.004, []uint64{1, 1, 1})
	if diff := assertDiff(); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	// invalid buckets
	_ = agg.Add([]string{"foo"}, 1, 0.004, []uint64{})
	if diff := assertDiff(); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	// invalid labels
	_ = agg.Add([]string{"foo", "bar"}, 1, 0.004, []uint64{1, 1, 1})
	if diff := assertDiff(); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	count = count + 5
	sum = sum + 0.015
	lowCount = lowCount + 5
	midCount = midCount + 5
	highCount = highCount + 5
	_ = agg.Add([]string{"foo"}, 5, 0.015, []uint64{5, 5, 5})
	if diff := assertDiff(); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}

	count = count + 20
	sum = sum + 0.4700000000000003
	lowCount = lowCount + 5
	midCount = midCount + 10
	highCount = highCount + 15
	_ = agg.Add([]string{"foo"}, 20, 0.4700000000000003, []uint64{5, 10, 15})
	if diff := assertDiff(); diff != "" {
		t.Errorf("unexpected output (-want +got):\n%s", diff)
	}
}
