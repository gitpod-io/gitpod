// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package protocol

import "testing"

func TestGetSSOEmail(t *testing.T) {
	u := &User{
		Identities: []*Identity{
			{
				PrimaryEmail:   "john@example.com",
				LastSigninTime: "2022-01-01T00:00:00Z",
			},
			{
				PrimaryEmail:   "bob@example.com",
				LastSigninTime: "2022-03-01T00:00:00Z",
			},
			{
				PrimaryEmail:   "jane@example.com",
				LastSigninTime: "2022-02-01T00:00:00Z",
			},
			{
				PrimaryEmail:   "jane22@example.com",
				LastSigninTime: "",
			},
		},
	}

	expectedEmail := "bob@example.com"
	actualEmail := u.GetSSOEmail()

	if actualEmail != expectedEmail {
		t.Errorf("Expected SSO email to be %s, but got %s", expectedEmail, actualEmail)
	}
}
func TestGetRandomEmail(t *testing.T) {
	u := &User{
		Identities: []*Identity{
			{
				PrimaryEmail:   "",
				LastSigninTime: "",
			},
			{
				PrimaryEmail:   "oldjohn@example.com",
				LastSigninTime: "",
				Deleted:        true,
			},
			{
				PrimaryEmail:   "john@example.com",
				LastSigninTime: "",
			},
			{
				PrimaryEmail:   "bob@example.com",
				LastSigninTime: "2022-03-01T00:00:00Z",
			},
			{
				PrimaryEmail:   "jane@example.com",
				LastSigninTime: "2022-02-01T00:00:00Z",
			},
			{
				PrimaryEmail:   "jane22@example.com",
				LastSigninTime: "",
			},
		},
	}

	expectedEmail := "john@example.com"
	actualEmail := u.GetRandomEmail()

	if actualEmail != expectedEmail {
		t.Errorf("Expected random email to be %s, but got %s", expectedEmail, actualEmail)
	}
}
