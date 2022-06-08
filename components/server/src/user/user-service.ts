/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import {
    User,
    Identity,
    WorkspaceTimeoutDuration,
    UserEnvVarValue,
    Token,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
    WORKSPACE_TIMEOUT_EXTENDED,
    WORKSPACE_TIMEOUT_EXTENDED_ALT,
} from "@gitpod/gitpod-protocol";
import { TermsAcceptanceDB, UserDB } from "@gitpod/gitpod-db/lib";
import { HostContextProvider } from "../auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Config } from "../config";
import { AuthProviderParams, AuthUser } from "../auth/auth-provider";
import { BlockedUserFilter } from "../auth/blocked-user-filter";
import { v4 as uuidv4 } from "uuid";
import { TermsProvider } from "../terms/terms-provider";
import { TokenService } from "./token-service";
import { EmailAddressAlreadyTakenException, SelectAccountException } from "../auth/errors";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";

export interface FindUserByIdentityStrResult {
    user: User;
    identity: Identity;
    authHost: string;
}

export interface CheckSignUpParams {
    config: AuthProviderParams;
    identity: Identity;
}

export interface CheckTermsParams {
    config: AuthProviderParams;
    identity?: Identity;
    user?: User;
}
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
    @inject(BlockedUserFilter) protected readonly blockedUserFilter: BlockedUserFilter;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(Config) protected readonly config: Config;
    @inject(TermsAcceptanceDB) protected readonly termsAcceptanceDb: TermsAcceptanceDB;
    @inject(TermsProvider) protected readonly termsProvider: TermsProvider;

    /**
     * Takes strings in the form of <authHost>/<authName> and returns the matching User
     * @param identityStr A string of the form <authHost>/<authName>
     * @returns The User associated with the identified Identity
     */
    async findUserByIdentityStr(identityStr: string): Promise<FindUserByIdentityStrResult | undefined> {
        const parts = identityStr.split("/");
        if (parts.length !== 2) {
            return undefined;
        }
        const [authHost, authName] = parts;
        if (!authHost || !authName) {
            return undefined;
        }
        const authProviderId = this.getAuthProviderIdForHost(authHost);
        if (!authProviderId) {
            return undefined;
        }

        const identities = await this.userDb.findIdentitiesByName({ authProviderId, authName });
        if (identities.length === 0) {
            return undefined;
        } else if (identities.length > 1) {
            // TODO Choose a better solution here. It blocks this lookup until the old account logs in again and gets their authName updated
            throw new Error(`Multiple identities with name: ${authName}`);
        }

        const identity = identities[0];
        const user = await this.userDb.findUserByIdentity(identity);
        if (!user) {
            return undefined;
        }
        return { user, identity, authHost };
    }

    protected getAuthProviderIdForHost(host: string): string | undefined {
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext || !hostContext.authProvider) {
            return undefined;
        }
        return hostContext.authProvider.authProviderId;
    }

    protected async getUser(user: User | string): Promise<User> {
        if (typeof user === "string") {
            const realUser = await this.userDb.findUserById(user);
            if (!realUser) {
                throw new Error(`No User found for id ${user}!`);
            }
            return realUser;
        } else {
            return user;
        }
    }

    private cachedIsFirstUser: boolean | undefined = undefined;
    public async createUser({ identity, token, userUpdate }: CreateUserParams): Promise<User> {
        log.debug("Creating new user.", { identity, "login-flow": true });

        const prevIsFirstUser = this.cachedIsFirstUser;
        // immediately updating the cached value here without awaiting the async user count
        // in order to make sure there is no race.
        this.cachedIsFirstUser = false;

        let isFirstUser = false;
        if (prevIsFirstUser === undefined) {
            // check user count only once
            isFirstUser = (await this.userDb.getUserCount()) === 0;
        }

        let newUser = await this.userDb.newUser();
        if (userUpdate) {
            userUpdate(newUser);
        }
        newUser.identities.push(identity);
        this.handleNewUser(newUser, isFirstUser);
        newUser = await this.userDb.storeUser(newUser);
        if (token) {
            await this.userDb.storeSingleToken(identity, token);
        }
        return newUser;
    }
    protected handleNewUser(newUser: User, isFirstUser: boolean) {
        if (this.config.blockNewUsers.enabled) {
            const emailDomainInPasslist = (mail: string) =>
                this.config.blockNewUsers.passlist.some((e) => mail.endsWith(`@${e}`));
            const canPass = newUser.identities.some((i) => !!i.primaryEmail && emailDomainInPasslist(i.primaryEmail));

            // blocked = if user already blocked OR is not allowed to pass
            newUser.blocked = newUser.blocked || !canPass;
        }
        if (!newUser.blocked && (isFirstUser || this.config.makeNewUsersAdmin)) {
            newUser.rolesOrPermissions = ["admin"];
        }
    }

    /**
     * Returns the default workspace timeout for the given user at a given point in time
     * @param user
     * @param date The date for which we want to know the default workspace timeout
     */
    async getDefaultWorkspaceTimeout(user: User, date: Date = new Date()): Promise<WorkspaceTimeoutDuration> {
        return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
    }

    public workspaceTimeoutToDuration(timeout: WorkspaceTimeoutDuration): string {
        switch (timeout) {
            case WORKSPACE_TIMEOUT_DEFAULT_SHORT:
                return "30m";
            case WORKSPACE_TIMEOUT_DEFAULT_LONG:
                return "60m";
            case WORKSPACE_TIMEOUT_EXTENDED:
            case WORKSPACE_TIMEOUT_EXTENDED_ALT:
                return "180m";
        }
    }

    public durationToWorkspaceTimeout(duration: string): WorkspaceTimeoutDuration {
        switch (duration) {
            case "30m":
                return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
            case "60m":
                return WORKSPACE_TIMEOUT_DEFAULT_LONG;
            case "180m":
                return WORKSPACE_TIMEOUT_EXTENDED_ALT;
            default:
                return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
        }
    }

    /**
     * Returns true if the user ought land in a cluster which offers more resources than
     * the default.
     *
     * @param user user to check for
     * @returns
     */
    async userGetsMoreResources(user: User): Promise<boolean> {
        return false;
    }

    /**
     * This might throw `AuthException`s.
     *
     * @param params
     */
    async checkSignUp(params: CheckSignUpParams) {
        // no-op
    }

    async checkTermsAcceptanceRequired(params: CheckTermsParams): Promise<boolean> {
        // // todo@alex: clarify if this would be a loophole for Gitpod SH.
        // // if (params.config.requireTOS === false) {
        // //     // AuthProvider config might disable terms acceptance
        // //     return false;
        // // }

        // const { user } = params;
        // if (!user) {
        //     const userCount = await this.userDb.getUserCount();
        //     if (userCount === 0) {
        //         // the very first user, which will become admin, needs to accept the terms. always.
        //         return true;
        //     }
        // }

        // // admin users need to accept the terms.
        // if (user && user.rolesOrPermissions && user.rolesOrPermissions.some(r => r === "admin")) {
        //     return (await this.checkTermsAccepted(user)) === false;
        // }

        // // non-admin users won't need to accept the terms.
        return false;
    }

    async acceptCurrentTerms(user: User) {
        const terms = this.termsProvider.getCurrent();
        return await this.termsAcceptanceDb.updateAcceptedRevision(user.id, terms.revision);
    }

    async checkTermsAccepted(user: User) {
        // disabled terms acceptance check for now

        return true;

        // const terms = this.termsProvider.getCurrent();
        // const accepted = await this.termsAcceptanceDb.getAcceptedRevision(user.id);
        // return !!accepted && (accepted.termsRevision === terms.revision);
    }

    async checkAutomaticOssEligibility(user: User): Promise<boolean> {
        // EE implementation
        return false;
    }

    async isBlocked(params: CheckIsBlockedParams): Promise<boolean> {
        if (params.user && params.user.blocked) {
            return true;
        }
        if (params.primaryEmail) {
            return this.blockedUserFilter.isBlocked(params.primaryEmail);
        }
        return false;
    }

    async blockUser(targetUserId: string, block: boolean): Promise<User> {
        const target = await this.userDb.findUserById(targetUserId);
        if (!target) {
            throw new Error("Not found.");
        }

        target.blocked = !!block;
        return await this.userDb.storeUser(target);
    }

    async findUserForLogin(params: { candidate: Identity }) {
        let user = await this.userDb.findUserByIdentity(params.candidate);
        return user;
    }

    async updateUserOnLogin(user: User, authUser: AuthUser, candidate: Identity, token: Token) {
        // update user
        user.name = user.name || authUser.name || authUser.primaryEmail;
        user.avatarUrl = user.avatarUrl || authUser.avatarUrl;

        await this.updateUserIdentity(user, candidate, token);
    }

    async updateUserIdentity(user: User, candidate: Identity, token: Token) {
        // ensure single identity per auth provider instance
        user.identities = user.identities.filter((i) => i.authProviderId !== candidate.authProviderId);
        user.identities.push(candidate);

        await this.userDb.storeUser(user);
        await this.userDb.storeSingleToken(candidate, token);
    }

    async updateUserEnvVarsOnLogin(user: User, envVars?: UserEnvVarValue[]) {
        if (!envVars) {
            return;
        }
        const userId = user.id;
        const currentEnvVars = await this.userDb.getEnvVars(userId);
        const findEnvVar = (name: string, repositoryPattern: string) =>
            currentEnvVars.find((env) => env.repositoryPattern === repositoryPattern && env.name === name);
        for (const { name, value, repositoryPattern } of envVars) {
            try {
                const existingEnvVar = findEnvVar(name, repositoryPattern);
                await this.userDb.setEnvVar(
                    existingEnvVar
                        ? {
                              ...existingEnvVar,
                              value,
                          }
                        : {
                              repositoryPattern,
                              name,
                              userId,
                              id: uuidv4(),
                              value,
                          },
                );
            } catch (error) {
                log.error(`Failed update user EnvVar on login!`, {
                    error,
                    user: User.censor(user),
                    envVar: { name, value, repositoryPattern },
                });
            }
        }
    }

    async deauthorize(user: User, authProviderId: string) {
        const builtInProviders = ["Public-GitLab", "Public-GitHub", "Public-Bitbucket"];
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

        if (
            remainingLoginIdentities.length === 1 &&
            !builtInProviders.includes(remainingLoginIdentities[0].authProviderId)
        ) {
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
}
