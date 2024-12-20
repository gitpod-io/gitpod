/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { User, Identity, Token, IdentityLookup } from "@gitpod/gitpod-protocol";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID, EmailDomainFilterDB, MaybeUser, UserDB } from "@gitpod/gitpod-db/lib";
import { HostContextProvider } from "../auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Config } from "../config";
import { AuthUser } from "../auth/auth-provider";
import { TokenService } from "./token-service";
import { EmailAddressAlreadyTakenException, SelectAccountException } from "../auth/errors";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { UserService } from "./user-service";
import { Authorizer } from "../authorization/authorizer";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { isOrganizationOwned, isAllowedToCreateOrganization } from "@gitpod/public-api-common/lib/user-utils";

export interface CreateUserParams {
    organizationId?: string;
    identity: Identity;
    token?: Token;
    userUpdate?: (user: User) => void;
}

export interface CheckIsBlockedParams {
    primaryEmail?: string;
    user?: User;
}

@injectable()
export class UserAuthentication {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(EmailDomainFilterDB) private readonly domainFilterDb: EmailDomainFilterDB,
        @inject(UserDB) private readonly userDb: UserDB,
        @inject(UserService) private readonly userService: UserService,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(Authorizer) private readonly authorizer: Authorizer,
    ) {}

    async blockUser(userId: string, targetUserId: string, block: boolean): Promise<User> {
        await this.authorizer.checkPermissionOnUser(userId, "admin_control", targetUserId);
        const target = await this.userService.findUserById(userId, targetUserId);
        target.blocked = !!block;
        return await this.userDb.storeUser(target);
    }

    async findUserForLogin(params: { candidate: IdentityLookup }) {
        const user = await this.userDb.findUserByIdentity(params.candidate);
        return this.loadClean(user);
    }

    // make sure we load through user service to ensure any sideffects (e.g. spicedb migrations) are applied
    private async loadClean(user?: User): Promise<User | undefined> {
        if (!user) {
            return undefined;
        }
        return await this.userService.findUserById(user.id, user.id);
    }

    async findOrgOwnedUser(params: { organizationId: string; email: string }): Promise<MaybeUser> {
        const user = await this.userDb.findOrgOwnedUser(params.organizationId, params.email);
        return this.loadClean(user);
    }

    async updateUserOnLogin(user: User, authUser: AuthUser, candidate: Identity, token: Token): Promise<User> {
        // update user
        user.name = user.name || authUser.name || authUser.primaryEmail;
        user.avatarUrl = user.avatarUrl || authUser.avatarUrl;
        await this.updateUserIdentity(user, candidate);
        await this.userDb.storeSingleToken(candidate, token);

        return await this.userService.findUserById(user.id, user.id);
    }

    async updateUserIdentity(user: User, candidate: Identity) {
        log.info("Updating user identity", {
            user,
            candidate,
        });
        // ensure single identity per auth provider instance
        user.identities = user.identities.filter((i) => i.authProviderId !== candidate.authProviderId);
        user.identities.push(candidate);

        await this.userDb.storeUser(user);
    }

    async deauthorize(user: User, authProviderId: string) {
        const externalIdentities = user.identities.filter(
            (i) => i.authProviderId !== TokenService.GITPOD_AUTH_PROVIDER_ID,
        );
        const identity = externalIdentities.find((i) => i.authProviderId === authProviderId);
        if (!identity) {
            log.debug("Cannot deauthorize. Authorization not found.", { userId: user.id, authProviderId });
            return;
        }
        const isBuiltin = (authProviderId: string) =>
            !!this.hostContextProvider.findByAuthProviderId(authProviderId)?.authProvider?.params?.builtin;
        const remainingLoginIdentities = externalIdentities.filter(
            (i) => i !== identity && (!this.config.disableDynamicAuthProviderLogin || isBuiltin(i.authProviderId)),
        );

        // Disallow users to deregister the last builtin auth provider's from their user
        if (remainingLoginIdentities.length === 0) {
            throw new Error(
                "Cannot remove last authentication provider for logging in to Gitpod. Please delete account if you want to leave.",
            );
        }

        // explicitly remove associated tokens
        await this.userDb.deleteTokens(identity);

        // effectively remove the provider authorization
        user.identities = user.identities.filter((i) => i.authProviderId !== authProviderId);
        await this.userDb.storeUser(user);
    }

    async assertNoTwinAccount(currentUser: User, authHost: string, authProviderId: string, candidate: Identity) {
        if (User.isOrganizationOwned(currentUser)) {
            /**
             * The restriction of SCM identities doesn't apply to organization owned accounts which were
             * created through OIDC SSO because this identity is not used to create/find the account of a user.
             *
             * Hint: with this restriction lifted, the subsequent call to `#updateUserOnLogin` would always add/update
             * the SCM identity for the given `currentUser` if it's owned by an organization.
             */
            return;
        }
        if (currentUser.identities.some((i) => Identity.equals(i, candidate))) {
            return; // same user => OK
        }
        const otherUser = await this.findUserForLogin({ candidate });
        if (!otherUser) {
            return; // no twin => OK
        }

        /*
         * /!\ another user account is connected with this provider identity.
         */

        const externalIdentities = currentUser.identities.filter(
            (i) => i.authProviderId !== TokenService.GITPOD_AUTH_PROVIDER_ID,
        );
        const loginIdentityOfCurrentUser = externalIdentities[externalIdentities.length - 1];
        const authProviderConfigOfCurrentUser = this.hostContextProvider
            .getAll()
            .find((c) => c.authProvider.authProviderId === loginIdentityOfCurrentUser.authProviderId)
            ?.authProvider?.params;
        const loginHostOfCurrentUser = authProviderConfigOfCurrentUser?.host;
        const authProviderTypeOfCurrentUser = authProviderConfigOfCurrentUser?.type;

        const authProviderTypeOfOtherUser = this.hostContextProvider
            .getAll()
            .find((c) => c.authProvider.authProviderId === candidate.authProviderId)?.authProvider?.params?.type;

        const payload: SelectAccountPayload = {
            currentUser: {
                name: currentUser.name!,
                avatarUrl: currentUser.avatarUrl!,
                authHost: loginHostOfCurrentUser!,
                authName: loginIdentityOfCurrentUser.authName,
                authProviderType: authProviderTypeOfCurrentUser!,
            },
            otherUser: {
                name: otherUser.name!,
                avatarUrl: otherUser.avatarUrl!,
                authHost,
                authName: candidate.authName,
                authProviderType: authProviderTypeOfOtherUser!,
            },
        };
        throw SelectAccountException.create(`User is trying to connect a provider identity twice.`, payload);
    }

    async asserNoAccountWithEmail(email: string) {
        const existingUser = (await this.userDb.findUsersByEmail(email))[0];
        if (!existingUser) {
            // no user has this email address ==> OK
            return;
        }

        /*
         * /!\ the given email address is used in another user account.
         */
        const authProviderId = existingUser.identities.find((i) => i.primaryEmail === email)?.authProviderId;
        const host =
            this.hostContextProvider.getAll().find((c) => c.authProvider.authProviderId === authProviderId)
                ?.authProvider?.info?.host || "unknown";

        throw EmailAddressAlreadyTakenException.create(`Email address is already in use.`, { host });
    }

    /**
     * Only installation-level users are allowed to join other orgs then the one they belong to
     * @param user
     * @returns
     */
    async mayJoinOrganization(user: User): Promise<boolean> {
        return !isOrganizationOwned(user);
    }

    /**
     * gitpod.io: Only installation-level users are allowed to create orgs
     * Dedicated: Only if multiOrg is enabled, installation-level users (=admin-user) can create orgs
     * @param user
     * @returns
     */
    async mayCreateOrganization(user: User): Promise<boolean> {
        const isDedicated = this.config.isDedicatedInstallation;
        const isMultiOrgEnabled = await getExperimentsClientForBackend().getValueAsync("enable_multi_org", false, {
            gitpodHost: this.config.hostUrl.url.host,
        });
        return (
            isAllowedToCreateOrganization(user, isDedicated, isMultiOrgEnabled) ||
            (isDedicated && user.id === BUILTIN_INSTLLATION_ADMIN_USER_ID)
        );
    }

    async isBlocked(params: CheckIsBlockedParams): Promise<boolean> {
        if (params.user && params.user.blocked) {
            return true;
        }
        if (params.primaryEmail) {
            const { domain } = this.parseMail(params.primaryEmail);
            return this.domainFilterDb.isBlocked(domain);
        }
        return false;
    }

    private parseMail(email: string): { user: string; domain: string } {
        const parts = email.split("@");
        if (parts.length !== 2) {
            throw new Error("Invalid E-Mail address: " + email);
        }
        return { user: parts[0], domain: parts[1].toLowerCase() };
    }
}
