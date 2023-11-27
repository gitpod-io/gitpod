/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { User as UserProtocol } from "@gitpod/gitpod-protocol/lib/protocol";

/**
 * Returns a primary email address of a user.
 *
 * For accounts owned by an organization, it returns the email of the most recently used SSO identity.
 *
 * For personal accounts, first it looks for a email stored by the user, and falls back to any of the Git provider identities.
 *
 * @param user
 * @returns A primaryEmail, or undefined.
 */
export function getPrimaryEmail(user: User): string | undefined {
    // If the accounts is owned by an organization, use the email of the most recently
    // used SSO identity.
    if (isOrganizationOwned(user)) {
        const compareTime = (a?: string, b?: string) => (a || "").localeCompare(b || "");
        const recentlyUsedSSOIdentity = user.identities
            .sort((a, b) =>
                compareTime(a.lastSigninTime?.toDate()?.toISOString(), b.lastSigninTime?.toDate()?.toISOString()),
            )
            // optimistically pick the most recent one
            .reverse()[0];
        return recentlyUsedSSOIdentity?.primaryEmail;
    }

    // In case of a personal account, check for the email stored by the user.
    if (!isOrganizationOwned(user) && user.profile?.emailAddress) {
        return user.profile?.emailAddress;
    }

    // Otherwise pick any
    // FIXME(at) this is still not correct, as it doesn't distinguish between
    // sign-in providers and additional Git hosters.
    const identities = user.identities.filter((i) => !!i.primaryEmail);
    if (identities.length <= 0) {
        return undefined;
    }

    return identities[0].primaryEmail || undefined;
}

export function getName(user: User): string | undefined {
    const name = /* user.fullName ||*/ user.name;
    if (name) {
        return name;
    }

    for (const id of user.identities) {
        if (id.authName !== "") {
            return id.authName;
        }
    }
    return undefined;
}

export function hasPreferredIde(user: User) {
    return !!user?.editorSettings?.name || !!user?.editorSettings?.version;
}

export function isOnboardingUser(user: User) {
    if (isOrganizationOwned(user)) {
        return false;
    }
    // If a user has already been onboarded
    // Also, used to rule out "admin-user"
    if (!!user.profile?.onboardedTimestamp) {
        return false;
    }
    return !hasPreferredIde(user);
}

export function isOrganizationOwned(user: User) {
    return !!user.organizationId;
}

// FIXME(at) get rid of this Nth indirection to read attributes of User entity
export function getProfile(user: User): UserProtocol.Profile {
    return {
        name: getName(user!) || "",
        email: getPrimaryEmail(user!) || "",
        company: user?.profile?.companyName,
        avatarURL: user?.avatarUrl,
        jobRole: user?.profile?.jobRole,
        jobRoleOther: user?.profile?.jobRoleOther,
        explorationReasons: user?.profile?.explorationReasons,
        signupGoals: user?.profile?.signupGoals,
        signupGoalsOther: user?.profile?.signupGoalsOther,
        companySize: user?.profile?.companySize,
        onboardedTimestamp: user?.profile?.onboardedTimestamp,
    };
}
