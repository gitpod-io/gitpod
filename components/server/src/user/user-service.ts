/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Config } from "../config";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { Authorizer } from "../authorization/authorizer";
import {
    AdditionalUserData,
    Disposable,
    Identity,
    RoleOrPermission,
    TokenEntry,
    User,
    WorkspaceTimeoutDuration,
    WorkspaceTimeoutSetting,
} from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { CreateUserParams } from "./user-authentication";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { TransactionalContext } from "@gitpod/gitpod-db/lib/typeorm/transactional-db-impl";
import { RelationshipUpdater } from "../authorization/relationship-updater";
import { getName, getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";

@injectable()
export class UserService {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(UserDB) private readonly userDb: UserDB,
        @inject(Authorizer) private readonly authorizer: Authorizer,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(RelationshipUpdater) private readonly relationshipUpdater: RelationshipUpdater,
    ) {}

    public async createUser(
        { organizationId, identity, token, userUpdate }: CreateUserParams,
        transactionCtx?: TransactionalContext,
    ): Promise<User> {
        log.debug("Creating new user.", { identity, "login-flow": true });
        return await this.userDb.transaction(transactionCtx, async (userDb) => {
            const newUser = await userDb.newUser();
            newUser.organizationId = organizationId;
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
            const result = await userDb.storeUser(newUser);
            await this.authorizer.addUser(result.id, organizationId);
            if (token) {
                await userDb.storeSingleToken(identity, token);
            }
            return result;
        });
    }

    private handleNewUser(newUser: User) {
        if (this.config.blockNewUsers.enabled) {
            const emailDomainInPasslist = (mail: string) =>
                this.config.blockNewUsers.passlist.some((e) => mail.endsWith(`@${e}`));
            const canPass = newUser.identities.some((i) => !!i.primaryEmail && emailDomainInPasslist(i.primaryEmail));

            // blocked = if user already blocked OR is not allowed to pass
            newUser.blocked = newUser.blocked || !canPass;
        }
        if (newUser.additionalData) {
            // When a user is created, it does not have `additionalData.profile` set, so it's ok to rewrite it here.
            newUser.additionalData.profile = { acceptedPrivacyPolicyDate: new Date().toISOString() };
        }
    }

    async findUserById(userId: string, id: string): Promise<User> {
        if (userId !== id) {
            await this.authorizer.checkPermissionOnUser(userId, "read_info", id);
        }
        const result = await this.userDb.findUserById(id);
        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "not found");
        }
        try {
            return await this.relationshipUpdater.migrate(result);
        } catch (error) {
            log.error({ userId: id }, "Failed to migrate user", error);
            return result;
        }
    }

    async findTokensForIdentity(userId: string, identity: Identity): Promise<TokenEntry[]> {
        const result = await this.userDb.findTokensForIdentity(identity);
        return result;
    }

    async updateUser(userId: string, update: Partial<User> & { id: string }): Promise<User> {
        const user = await this.findUserById(userId, update.id);
        await this.authorizer.checkPermissionOnUser(userId, "write_info", user.id);

        //hang on to user profile before it's overwritten for analytics below
        const oldProfile = Profile.getProfile(user);

        const allowedFields: (keyof User)[] = ["fullName", "additionalData"];
        for (const p of allowedFields) {
            if (p in update) {
                (user[p] as any) = update[p];
            }
        }

        await this.userDb.updateUserPartial(user);

        //track event and user profile if profile of partialUser changed
        const newProfile = Profile.getProfile(user);
        if (Profile.hasChanges(oldProfile, newProfile)) {
            this.analytics.track({
                userId: user.id,
                event: "profile_changed",
                properties: { new: newProfile, old: oldProfile },
            });
            this.analytics.identify({
                userId: user.id,
                traits: { email: newProfile.email, company: newProfile.company, name: newProfile.name },
            });
        }
        return user;
    }

    async updateWorkspaceTimeoutSetting(
        userId: string,
        targetUserId: string,
        setting: Partial<WorkspaceTimeoutSetting>,
    ): Promise<void> {
        await this.authorizer.checkPermissionOnUser(userId, "write_info", targetUserId);

        if (setting.workspaceTimeout) {
            try {
                WorkspaceTimeoutDuration.validate(setting.workspaceTimeout);
            } catch (err) {
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, String(err));
            }
        }

        const user = await this.findUserById(userId, targetUserId);
        AdditionalUserData.set(user, setting);
        await this.userDb.updateUserPartial(user);
    }

    async listUsers(
        userId: string,
        req: {
            offset?: number;
            limit?: number;
            orderBy?: keyof User;
            orderDir?: "ASC" | "DESC";
            searchTerm?: string;
        },
    ): Promise<{ total: number; rows: User[] }> {
        try {
            const res = await this.userDb.findAllUsers(
                req.offset || 0,
                req.limit || 100,
                req.orderBy || "creationDate",
                req.orderDir || "DESC",
                req.searchTerm,
            );
            const result = { total: res.total, rows: [] as User[] };
            for (const user of res.rows) {
                if (await this.authorizer.hasPermissionOnUser(userId, "read_info", user.id)) {
                    result.rows.push(user);
                } else {
                    result.total--;
                }
            }
            return result;
        } catch (err) {
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, String(err));
        }
    }

    async updateRoleOrPermission(
        userId: string,
        targetUserId: string,
        modifications: { role: RoleOrPermission; add?: boolean }[],
    ): Promise<void> {
        await this.authorizer.checkPermissionOnUser(userId, "make_admin", targetUserId);
        const target = await this.findUserById(userId, targetUserId);
        const rolesOrPermissions = new Set((target.rolesOrPermissions || []) as string[]);
        const adminBefore = rolesOrPermissions.has("admin");
        modifications.forEach((e) => {
            if (e.add) {
                rolesOrPermissions.add(e.role as string);
            } else {
                rolesOrPermissions.delete(e.role as string);
            }
        });
        target.rolesOrPermissions = Array.from(rolesOrPermissions.values()) as RoleOrPermission[];
        const adminAfter = new Set(target.rolesOrPermissions).has("admin");
        try {
            await this.userDb.transaction(async (userDb) => {
                await userDb.storeUser(target);
                if (adminBefore !== adminAfter) {
                    if (adminAfter) {
                        await this.authorizer.addInstallationAdminRole(target.id);
                    } else {
                        await this.authorizer.removeInstallationAdminRole(target.id);
                    }
                }
            });
        } catch (error) {
            if (adminBefore !== adminAfter) {
                if (adminAfter) {
                    await this.authorizer.removeInstallationAdminRole(target.id);
                } else {
                    await this.authorizer.addInstallationAdminRole(target.id);
                }
            }
            throw error;
        }
    }

    async resetFgaVersion(subjectId: string, userId: string) {
        await this.authorizer.checkPermissionOnUser(subjectId, "write_info", userId);

        await this.userDb.updateUserPartial({ id: userId, fgaRelationshipsVersion: undefined });
    }

    private onDeleteListeners = new Set<
        (subjectId: string, user: User, transactionCtx: TransactionalContext) => Promise<void>
    >();
    public onDeleteUser(
        handler: (subjectId: string, user: User, transactionCtx: TransactionalContext) => Promise<void>,
    ): Disposable {
        this.onDeleteListeners.add(handler);
        return {
            dispose: () => {
                this.onDeleteListeners.delete(handler);
            },
        };
    }

    /**
     * This method deletes a User logically. The contract here is that after running this method without receiving an
     * error, the system does not contain any data that is relatable to the actual person in the sense of the GDPR.
     * To guarantee that, but also maintain traceability
     * we anonymize data that might contain user related/relatable data and keep the entities itself (incl. ids).
     */
    async deleteUser(subjectId: string, targetUserId: string) {
        await this.authorizer.checkPermissionOnUser(subjectId, "delete", targetUserId);

        await this.userDb.transaction(async (db, ctx) => {
            const user = await this.userDb.findUserById(targetUserId);
            if (!user) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `No user with id ${targetUserId} found!`);
            }

            if (user.markedDeleted === true) {
                log.debug({ userId: targetUserId }, "Is deleted but markDeleted already set. Continuing.");
            }
            for (const listener of this.onDeleteListeners) {
                await listener(subjectId, user, ctx);
            }
            user.avatarUrl = "deleted-avatarUrl";
            user.fullName = "deleted-fullName";
            user.name = "deleted-Name";
            if (user.verificationPhoneNumber) {
                user.verificationPhoneNumber = "deleted-phoneNumber";
            }
            for (const identity of user.identities) {
                identity.deleted = true;
                await db.deleteTokens(identity);
            }
            user.lastVerificationTime = undefined;
            user.markedDeleted = true;
            await db.storeUser(user);
        });

        // Track the deletion Event for Analytics Purposes
        this.analytics.track({
            userId: targetUserId,
            event: "deletion",
            properties: {
                deleted_at: new Date().toISOString(),
            },
        });
        this.analytics.identify({
            userId: targetUserId,
            traits: {
                github_slug: "deleted-user",
                gitlab_slug: "deleted-user",
                bitbucket_slug: "deleted-user",
                email: "deleted-user",
                full_name: "deleted-user",
                name: "deleted-user",
            },
        });
    }

    public async markUserAsVerified(user: User, phoneNumber: string | undefined) {
        user.lastVerificationTime = new Date().toISOString();
        if (phoneNumber) {
            user.verificationPhoneNumber = phoneNumber;
        }
        await this.userDb.updateUserPartial(user);
        log.info("User verified", { userId: user.id });
    }
}

// TODO: refactor where this is referenced so it's more clearly tied to just analytics-tracking
// Let other places rely on the ProfileDetails type since that's what we store
// This is the profile data we send to our Segment analytics tracking pipeline
interface Profile {
    name: string;
    email: string;
    company?: string;
    avatarURL?: string;
    jobRole?: string;
    jobRoleOther?: string;
    explorationReasons?: string[];
    signupGoals?: string[];
    signupGoalsOther?: string;
    onboardedTimestamp?: string;
    companySize?: string;
}
namespace Profile {
    export function hasChanges(before: Profile, after: Profile) {
        return (
            before.name !== after.name ||
            before.email !== after.email ||
            before.company !== after.company ||
            before.avatarURL !== after.avatarURL ||
            before.jobRole !== after.jobRole ||
            before.jobRoleOther !== after.jobRoleOther ||
            // not checking explorationReasons or signupGoals atm as it's an array - need to check deep equality
            before.signupGoalsOther !== after.signupGoalsOther ||
            before.onboardedTimestamp !== after.onboardedTimestamp ||
            before.companySize !== after.companySize
        );
    }

    export function getProfile(user: User): Profile {
        const profile = user.additionalData?.profile;
        return {
            name: getName(user) || "",
            email: getPrimaryEmail(user) || "",
            company: profile?.companyName,
            avatarURL: user?.avatarUrl,
            jobRole: profile?.jobRole,
            jobRoleOther: profile?.jobRoleOther,
            explorationReasons: profile?.explorationReasons,
            signupGoals: profile?.signupGoals,
            signupGoalsOther: profile?.signupGoalsOther,
            companySize: profile?.companySize,
            onboardedTimestamp: profile?.onboardedTimestamp,
        };
    }
}
