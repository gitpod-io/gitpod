/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { User, Identity, UserEnvVarValue, Token, Workspace } from "@gitpod/gitpod-protocol";
import { ProjectDB, TeamDB, TermsAcceptanceDB, UserDB } from "@gitpod/gitpod-db/lib";
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
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { StripeService } from "../../ee/src/user/stripe-service";
import { ResponseError } from "vscode-ws-jsonrpc";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { UsageService } from "./usage-service";
import { UserToTeamMigrationService } from "@gitpod/gitpod-db/lib/user-to-team-migration-service";
import { ConfigCatClientFactory } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

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

export interface UsageLimitReachedResult {
    reached: boolean;
    almostReached?: boolean;
    attributionId: AttributionId;
}

@injectable()
export class UserService {
    @inject(BlockedUserFilter) protected readonly blockedUserFilter: BlockedUserFilter;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(Config) protected readonly config: Config;
    @inject(TermsAcceptanceDB) protected readonly termsAcceptanceDb: TermsAcceptanceDB;
    @inject(TermsProvider) protected readonly termsProvider: TermsProvider;
    @inject(ProjectDB) protected readonly projectDb: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(StripeService) protected readonly stripeService: StripeService;
    @inject(UsageService) protected readonly usageService: UsageService;
    @inject(UserToTeamMigrationService) protected readonly migrationService: UserToTeamMigrationService;
    @inject(ConfigCatClientFactory) protected readonly configCatClientFactory: ConfigCatClientFactory;

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
        if (!newUser.blocked && isFirstUser && this.config.admin.grantFirstUserAdminRole) {
            newUser.rolesOrPermissions = ["admin"];
        }
    }

    protected async validateUsageAttributionId(user: User, usageAttributionId: string): Promise<AttributionId> {
        const attribution = AttributionId.parse(usageAttributionId);
        if (!attribution) {
            throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "The billing team id configured is invalid.");
        }
        if (attribution.kind === "team") {
            const team = await this.teamDB.findTeamById(attribution.teamId);
            if (!team) {
                throw new ResponseError(
                    ErrorCodes.INVALID_COST_CENTER,
                    "The billing team you've selected no longer exists.",
                );
            }
            const members = await this.teamDB.findMembersByTeam(team.id);
            if (!members.find((m) => m.userId === user.id)) {
                throw new ResponseError(
                    ErrorCodes.INVALID_COST_CENTER,
                    "You're no longer a member of the selected billing team.",
                );
            }
        }
        if (attribution.kind === "user") {
            if (user.id !== attribution.userId) {
                throw new ResponseError(
                    ErrorCodes.INVALID_COST_CENTER,
                    "You can select either yourself or a team you are a member of",
                );
            }
        }
        const billedAttributionIds = await this.listAvailableUsageAttributionIds(user);
        if (billedAttributionIds.find((id) => AttributionId.equals(id, attribution)) === undefined) {
            throw new ResponseError(
                ErrorCodes.INVALID_COST_CENTER,
                "You can select either yourself or a billed team you are a member of",
            );
        }
        return attribution;
    }

    /**
     * Identifies the team or user to which a workspace instance's running time should be attributed to
     * (e.g. for usage analytics or billing purposes).
     *
     *
     * @param user
     * @param projectId
     * @returns The validated AttributionId
     */
    async getWorkspaceUsageAttributionId(user: User, projectId?: string): Promise<AttributionId> {
        // if it's a workspace for a project the user has access to and the costcenter has credits use that
        if (projectId) {
            let attributionId: AttributionId | undefined;
            const project = await this.projectDb.findProjectById(projectId);
            if (project?.teamId) {
                const teams = await this.teamDB.findTeamsByUser(user.id);
                const team = teams.find((t) => t.id === project?.teamId);
                if (team) {
                    attributionId = AttributionId.create(team);
                }
            } else if (!user?.additionalData?.isMigratedToTeamOnlyAttribution) {
                attributionId = AttributionId.create(user);
            }
            if (!!attributionId && (await this.hasCredits(attributionId))) {
                return attributionId;
            }
        }
        if (user.usageAttributionId) {
            // Return the user's explicit attribution ID.
            return await this.validateUsageAttributionId(user, user.usageAttributionId);
        }
        if (user?.additionalData?.isMigratedToTeamOnlyAttribution) {
            const teams = await this.teamDB.findTeamsByUser(user.id);
            if (teams.length > 0) {
                return AttributionId.create(teams[0]);
            }
            throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "No team found for user");
        }
        return AttributionId.create(user);
    }

    /**
     * @param user
     * @param workspace - optional, in which case the default billing account will be checked
     * @returns
     */
    async checkUsageLimitReached(user: User, workspace?: Workspace): Promise<UsageLimitReachedResult> {
        const attributionId = await this.getWorkspaceUsageAttributionId(user, workspace?.projectId);
        const creditBalance = await this.usageService.getCurrentBalance(attributionId);
        const currentInvoiceCredits = creditBalance.usedCredits;
        const usageLimit = creditBalance.usageLimit;
        if (currentInvoiceCredits >= usageLimit) {
            log.info({ userId: user.id }, "Usage limit reached", {
                attributionId,
                currentInvoiceCredits,
                usageLimit,
            });
            return {
                reached: true,
                attributionId,
            };
        } else if (currentInvoiceCredits > usageLimit * 0.8) {
            log.info({ userId: user.id }, "Usage limit almost reached", {
                attributionId,
                currentInvoiceCredits,
                usageLimit,
            });
            return {
                reached: false,
                almostReached: true,
                attributionId,
            };
        }

        return {
            reached: false,
            attributionId,
        };
    }

    protected async hasCredits(attributionId: AttributionId): Promise<boolean> {
        const response = await this.usageService.getCurrentBalance(attributionId);
        return response.usedCredits < response.usageLimit;
    }

    async setUsageAttribution(user: User, usageAttributionId: string): Promise<void> {
        await this.validateUsageAttributionId(user, usageAttributionId);
        user.usageAttributionId = usageAttributionId;
        await this.userDb.storeUser(user);
    }

    /**
     * Lists all valid AttributionIds a user can attributed (billed) usage to.
     * @param user
     * @returns
     */
    async listAvailableUsageAttributionIds(user: User): Promise<AttributionId[]> {
        // List all teams available for attribution
        const result = (await this.teamDB.findTeamsByUser(user.id)).map((team) => AttributionId.create(team));
        if (user?.additionalData?.isMigratedToTeamOnlyAttribution) {
            return result;
        }
        return [AttributionId.create(user)].concat(result);
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
        await this.onAfterUserLoad(user);
        await this.updateUserIdentity(user, candidate, token);
    }

    async onAfterUserLoad(user: User): Promise<User> {
        try {
            // migrate user to team only attribution
            const shouldMigrate = this.configCatClientFactory().getValueAsync("team_only_attribution", false, {
                user,
            });
            if (User.is(user) && (await this.migrationService.needsMigration(user)) && (await shouldMigrate)) {
                return await this.migrationService.migrateUser(user);
            }
        } catch (error) {
            log.error({ user }, `Migrating user to team-only attribution failed`);
        }
        return user;
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
