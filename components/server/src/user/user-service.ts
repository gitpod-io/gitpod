/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { User, Identity, Token, IdentityLookup, AdditionalUserData } from "@gitpod/gitpod-protocol";
import { EmailDomainFilterDB, MaybeUser, UserDB } from "@gitpod/gitpod-db/lib";
import { HostContextProvider } from "../auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Config } from "../config";
import { AuthUser } from "../auth/auth-provider";
import { TokenService } from "./token-service";
import { EmailAddressAlreadyTakenException, SelectAccountException } from "../auth/errors";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";

export interface CreateUserParams {
    identity: Identity;
    token?: Token;
    userUpdate?: (user: User) => void;
}

export interface CheckIsBlockedParams {
    primaryEmail?: string;
    user?: User;
}

@injectable()
export class UserService {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(EmailDomainFilterDB) private readonly domainFilterDb: EmailDomainFilterDB,
        @inject(UserDB) private readonly userDb: UserDB,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
    ) {}

    public async createUser({ identity, token, userUpdate }: CreateUserParams): Promise<User> {
        log.debug("Creating new user.", { identity, "login-flow": true });

        let newUser = await this.userDb.newUser();
        if (userUpdate) {
            userUpdate(newUser);
        }
        // HINT: we need to specify `deleted: false` here, so that any attempt to reuse the same
        // entry would converge to a valid state. The identities are identified by the external
        // `authId`, and if accounts are deleted, such entries are soft-deleted until the periodic
        // deleter will take care of them. Reuse of soft-deleted entries would lead to an invalid
        // state. This measure of prevention is considered in the period deleter as well.
        newUser.identities.push({ ...identity, deleted: false });
        this.handleNewUser(newUser);
        // new users should not see the migration message
        AdditionalUserData.set(newUser, { shouldSeeMigrationMessage: false });
        newUser = await this.userDb.storeUser(newUser);
        if (token) {
            await this.userDb.storeSingleToken(identity, token);
        }
        return newUser;
    }

    private handleNewUser(newUser: User) {
        if (this.config.blockNewUsers.enabled) {
            const emailDomainInPasslist = (mail: string) =>
                this.config.blockNewUsers.passlist.some((e) => mail.endsWith(`@${e}`));
            const canPass = newUser.identities.some((i) => !!i.primaryEmail && emailDomainInPasslist(i.primaryEmail));

            // blocked = if user already blocked OR is not allowed to pass
            newUser.blocked = newUser.blocked || !canPass;
        }
    }

    async blockUser(targetUserId: string, block: boolean): Promise<User> {
        const target = await this.userDb.findUserById(targetUserId);
        if (!target) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "not found");
        }

        target.blocked = !!block;
        return await this.userDb.storeUser(target);
    }

    async findUserForLogin(params: { candidate: IdentityLookup }) {
        const user = await this.userDb.findUserByIdentity(params.candidate);
        return user;
    }

    async findOrgOwnedUser(params: { organizationId: string; email: string }): Promise<MaybeUser> {
        const user = await this.userDb.findOrgOwnedUser(params.organizationId, params.email);
        return user;
    }

    async updateUserOnLogin(user: User, authUser: AuthUser, candidate: Identity, token: Token): Promise<User> {
        // update user
        user.name = user.name || authUser.name || authUser.primaryEmail;
        user.avatarUrl = user.avatarUrl || authUser.avatarUrl;
        await this.onAfterUserLoad(user);
        await this.updateUserIdentity(user, candidate);
        await this.userDb.storeSingleToken(candidate, token);

        const updated = await this.userDb.findUserById(user.id);
        if (!updated) {
            throw new Error("User does not exist");
        }
        return updated;
    }

    async onAfterUserLoad(user: User): Promise<User> {
        return user;
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

    async asserNoTwinAccount(currentUser: User, authHost: string, authProviderId: string, candidate: Identity) {
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
     * Only installation-level users are allowed to create/join other orgs then the one they belong to
     * @param user
     * @returns
     */
    async mayCreateOrJoinOrganization(user: User): Promise<boolean> {
        return !user.organizationId;
    }

    async updateUser(userID: string, update: Partial<User>): Promise<User> {
        const user = await this.userDb.findUserById(userID);
        if (!user) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "User does not exist.");
        }

        const allowedFields: (keyof User)[] = ["fullName", "additionalData"];
        for (const p of allowedFields) {
            if (p in update) {
                (user[p] as any) = update[p];
            }
        }

        await this.userDb.updateUserPartial(user);
        return user;
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
