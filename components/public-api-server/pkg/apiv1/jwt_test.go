// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"testing"
)

func TestPrepareClaim(t *testing.T) {
	subber := NewSubClaim(":", true)

	claims := []Claim{
		{Key: "repo", Value: "https://github.com/gitpod-io/gitpod-vscode-desktop"},
		{Key: "org_id", Value: "35ec3933-83ab-4324-ad36-d4a65d678245"},
		{Key: "user_id", Value: "ceab0063-f688-4aaf-b053-8a0d158981f8"},
		{Key: "org", Value: "google"},
		{Key: "special_ability", Value: "throwing 🍎s"},
	}

	// Prepare the sub claim
	claim, err := subber.PrepareSubClaim(claims...)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	expected := "repo:https%3A%2F%2Fgithub.com%2Fgitpod-io%2Fgitpod-vscode-desktop:org_id:35ec3933-83ab-4324-ad36-d4a65d678245:user_id:ceab0063-f688-4aaf-b053-8a0d158981f8:org:google:special_ability:throwing+%F0%9F%8D%8Es"
	if claim != expected {
		t.Errorf("Expected %s, but got %s", expected, claim)
	}
}
