// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestIsECRRegistry(t *testing.T) {
	tests := []struct {
		Registry    string
		Expectation bool
	}{
		{Registry: "422899872803.dkr.ecr.eu-central-1.amazonaws.com/private-repo-demo:latest", Expectation: true},
		{Registry: "422899872803.dkr.ecr.eu-central-1.amazonaws.com", Expectation: true},
		{Registry: "index.docker.io/foo:bar", Expectation: false},
	}

	for _, test := range tests {
		t.Run(test.Registry, func(t *testing.T) {
			act := isECRRegistry(test.Registry)

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("isECRRegistry() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
