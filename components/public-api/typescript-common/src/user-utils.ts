/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { User as UserProtocol } from "@gitpod/gitpod-protocol/lib/protocol";
import { Timestamp } from "@bufbuild/protobuf";

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
export function getPrimaryEmail(user: User | UserProtocol): string | undefined {
    // If the accounts is owned by an organization, use the email of the most recently
    // used SSO identity.
    if (isOrganizationOwned(user)) {
        const timestampToString = (a?: string | Timestamp) =>
            a instanceof Timestamp ? a?.toDate()?.toISOString() : a || "";
        const compareTime = (a?: string | Timestamp, b?: string | Timestamp) => {
            return timestampToString(a).localeCompare(timestampToString(b));
        };
        const recentlyUsedSSOIdentity = user.identities
            .sort((a, b) => compareTime(a.lastSigninTime, b.lastSigninTime))
            // optimistically pick the most recent one
            .reverse()[0];
        return recentlyUsedSSOIdentity?.primaryEmail;
    }

    // In case of a personal account, check for the email stored by the user.
    if (!isOrganizationOwned(user)) {
        const emailAddress =
            user instanceof User //
                ? user.profile?.emailAddress
                : user.additionalData?.profile?.emailAddress;
        if (emailAddress) {
            return emailAddress;
        }
    }

    // Otherwise pick any
    // FIXME(at) this is still not correct, as it doesn't distinguish between
    // sign-in providers and additional Git hosters.
    const primaryEmails: string[] = user.identities.map((i) => i.primaryEmail || "").filter((e) => !!e);
    if (primaryEmails.length <= 0) {
        return undefined;
    }

    return primaryEmails[0] || undefined;
}

export function getName(user: User | UserProtocol): string | undefined {
    const name = user.name;
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

export function isOrganizationOwned(user: User | UserProtocol) {
    return !!user.organizationId;
}

/**
 * gitpod.io: Only installation-level users are allowed to create orgs (installation-level users on gitpod.io, and admin user on Dedicated)
 * Dedicated: Only if multiOrg is enabled, installation-level users can create orgs
 * @param user
 * @param isDedicated
 * @param isMultiOrgEnabled
 * @returns
 */
export function isAllowedToCreateOrganization(
    user: User | UserProtocol,
    isDedicated: boolean,
    isMultiOrgEnabled?: boolean,
): boolean {
    if (!isDedicated) {
        // gitpod.io case
        return !isOrganizationOwned(user);
    }

    return !isOrganizationOwned(user) && !!isMultiOrgEnabled;
}
