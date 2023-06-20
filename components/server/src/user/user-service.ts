/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { User, Identity, Token, IdentityLookup, AdditionalUserData } from "@gitpod/gitpod-protocol";
import { EmailDomainFilterDB, MaybeUser, ProjectDB, TeamDB, UserDB } from "@gitpod/gitpod-db/lib";
import { HostContextProvider } from "../auth/host-context-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Config } from "../config";
import { AuthUser } from "../auth/auth-provider";
import { TokenService } from "./token-service";
import { EmailAddressAlreadyTakenException, SelectAccountException } from "../auth/errors";
import { SelectAccountPayload } from "@gitpod/gitpod-protocol/lib/auth";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { ResponseError } from "vscode-ws-jsonrpc";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { UsageService } from "./usage-service";
import { UserToTeamMigrationService } from "../migration/user-to-team-migration-service";

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
    @inject(Config) protected readonly config: Config;

    @inject(EmailDomainFilterDB) protected readonly domainFilterDb: EmailDomainFilterDB;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(ProjectDB) protected readonly projectDb: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;

    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(UsageService) protected readonly usageService: UsageService;
    @inject(UserToTeamMigrationService) protected readonly migrationService: UserToTeamMigrationService;

    protected getAuthProviderIdForHost(host: string): string | undefined {
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext || !hostContext.authProvider) {
            return undefined;
        }
        return hostContext.authProvider.authProviderId;
    }

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
        // all new users are considered migrated
        AdditionalUserData.set(newUser, { shouldSeeMigrationMessage: false, isMigratedToTeamOnlyAttribution: true });
        newUser = await this.userDb.storeUser(newUser);
        if (token) {
            await this.userDb.storeSingleToken(identity, token);
        }
        return newUser;
    }

    protected handleNewUser(newUser: User) {
        if (this.config.blockNewUsers.enabled) {
            const emailDomainInPasslist = (mail: string) =>
                this.config.blockNewUsers.passlist.some((e) => mail.endsWith(`@${e}`));
            const canPass = newUser.identities.some((i) => !!i.primaryEmail && emailDomainInPasslist(i.primaryEmail));

            // blocked = if user already blocked OR is not allowed to pass
            newUser.blocked = newUser.blocked || !canPass;
        }
    }

    protected async validateUsageAttributionId(user: User, usageAttributionId: string): Promise<AttributionId> {
        const attribution = AttributionId.parse(usageAttributionId);
        if (!attribution) {
            throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "The provided attributionId is invalid.", {
                id: usageAttributionId,
            });
        }
        if (attribution.kind === "team") {
            const team = await this.teamDB.findTeamById(attribution.teamId);
            if (!team) {
                throw new ResponseError(
                    ErrorCodes.INVALID_COST_CENTER,
                    "Organization not found. Please contact support if you believe this is an error.",
                );
            }
            const members = await this.teamDB.findMembersByTeam(team.id);
            if (!members.find((m) => m.userId === user.id)) {
                // if the user's not a member of an org, they can't see it
                throw new ResponseError(
                    ErrorCodes.INVALID_COST_CENTER,
                    "Organization not found. Please contact support if you believe this is an error.",
                );
            }
        }
        if (attribution.kind === "user") {
            if (user.id !== attribution.userId) {
                throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "Invalid organizationId.");
            }
        }
        const billedAttributionIds = await this.listAvailableUsageAttributionIds(user);
        if (billedAttributionIds.find((id) => AttributionId.equals(id, attribution)) === undefined) {
            throw new ResponseError(
                ErrorCodes.INVALID_COST_CENTER,
                "Organization not found. Please contact support if you believe this is an error.",
            );
        }
        return attribution;
    }

    /**
     * Identifies the team or user to which a workspace instance's running time should be attributed to
     * (e.g. for usage analytics or billing purposes).
     *
     * This is the legacy logic for determining a cost center. It's only used for workspaces that are started by users ibefore they have been migrated to org-only mode.
     *
     * @param user
     * @param projectId
     * @returns The validated AttributionId
     */
    async getWorkspaceUsageAttributionId(user: User, projectId?: string): Promise<AttributionId> {
        if (user.additionalData?.isMigratedToTeamOnlyAttribution) {
            throw new Error("getWorkspaceUsageAttributionId should not be called for users in org-only mode.");
        }
        // if it's a workspace for a project the user has access to and the org has credits use that
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
            throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "No organization found for user");
        }
        return AttributionId.create(user);
    }

    /**
     * @param user
     * @param workspace - optional, in which case the default billing account will be checked
     * @returns
     */
    async checkUsageLimitReached(user: User, organizationId?: string): Promise<UsageLimitReachedResult> {
        if (!organizationId && user.additionalData?.isMigratedToTeamOnlyAttribution) {
            throw new Error("organizationId must be provided for org-only users");
        }
        const attributionId = AttributionId.createFromOrganizationId(organizationId) || AttributionId.create(user);
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

    async blockUser(targetUserId: string, block: boolean): Promise<User> {
        const target = await this.userDb.findUserById(targetUserId);
        if (!target) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "not found");
        }

        target.blocked = !!block;
        return await this.userDb.storeUser(target);
    }

    async findUserForLogin(params: { candidate: IdentityLookup }) {
        let user = await this.userDb.findUserByIdentity(params.candidate);
        return user;
    }

    async findOrgOwnedUser(params: { organizationId: string; email: string }): Promise<MaybeUser> {
        let user = await this.userDb.findOrgOwnedUser(params.organizationId, params.email);
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
            throw new ResponseError(ErrorCodes.NOT_FOUND, "User does not exist.");
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

    protected parseMail(email: string): { user: string; domain: string } {
        const parts = email.split("@");
        if (parts.length !== 2) {
            throw new Error("Invalid E-Mail address: " + email);
        }
        return { user: parts[0], domain: parts[1].toLowerCase() };
    }
}
