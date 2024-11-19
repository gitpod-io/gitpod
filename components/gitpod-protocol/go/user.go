// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package protocol

import (
	"cmp"
	"slices"
)

// GetSSOEmail returns the email of the user's last-used SSO identity, if any. It mirros the funcationality we have implemeted in TS here: https://github.com/gitpod-io/gitpod/blob/e4ccbf0b4d224714ffd16719a3b5c50630d6edbc/components/public-api/typescript-common/src/user-utils.ts#L24-L35
func (u *User) GetSSOEmail() string {
	var ssoIdentities []*Identity
	for _, id := range u.Identities {
		// LastSigninTime is empty for non-SSO identities, and used as a filter here.
		if id == nil || id.Deleted || id.LastSigninTime == "" {
			continue
		}
		ssoIdentities = append(ssoIdentities, id)
	}
	if len(ssoIdentities) == 0 {
		return ""
	}

	// We are looking for the latest-used SSO identity.
	slices.SortFunc(ssoIdentities, func(i, j *Identity) int {
		return cmp.Compare(j.LastSigninTime, i.LastSigninTime)
	})
	return ssoIdentities[0].PrimaryEmail
}

// GetRandomEmail returns an email address of any of the user's identities.
func (u *User) GetRandomEmail() string {
	for _, id := range u.Identities {
		if id == nil || id.Deleted || id.PrimaryEmail == "" {
			continue
		}
		return id.PrimaryEmail
	}
	return ""
}
