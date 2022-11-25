package policy_test

import (
	"testing"

	"github.com/gitpod-io/gitpod/authenticator/pkg/policy"
	"github.com/google/go-cmp/cmp"
)

func TestResourceNameParse(t *testing.T) {
	tests := []struct {
		Input       string
		Expectation []policy.ResourceSegment
	}{
		{
			Input: "res:prj=*/team=agxagadgf/ws=bla1234/wsi=*",
			Expectation: []policy.ResourceSegment{
				{Type: "prj", ID: "*"},
				{Type: "team", ID: "agxagadgf"},
				{Type: "ws", ID: "bla1234"},
				{Type: "wsi", ID: "*"},
			},
		},
	}
	for _, test := range tests {
		res, err := policy.ResourceName(test.Input).Parse()
		if err != nil {
			t.Fatal(err)
		}

		if diff := cmp.Diff(test.Expectation, res); diff != "" {
			t.Errorf("Parse() mismatch (-want +got):\n%s", diff)
		}
	}
}
