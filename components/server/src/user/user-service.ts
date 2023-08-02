/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { Config } from "../config";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { Authorizer } from "../authorization/authorizer";
import { AdditionalUserData, Identity, TokenEntry, User } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { CreateUserParams } from "./user-authentication";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { TransactionalContext } from "@gitpod/gitpod-db/lib/typeorm/transactional-db-impl";

@injectable()
export class UserService {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(UserDB) private readonly userDb: UserDB,
        @inject(Authorizer) private readonly authorizer: Authorizer,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
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
            if (organizationId) {
                await this.authorizer.addOrganizationRole(organizationId, result.id, "member");
            } else {
                await this.authorizer.addInstallationMemberRole(result.id);
            }
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
    }

    async findUserById(userId: string, id: string): Promise<User> {
        await this.authorizer.checkPermissionOnUser(userId, "read_info", id);
        const result = await this.userDb.findUserById(id);
        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "not found");
        }
        return result;
    }

    async findTokensForIdentity(userId: string, identity: Identity): Promise<TokenEntry[]> {
        const result = await this.userDb.findTokensForIdentity(identity);
        for (const token of result) {
            if (!(await this.authorizer.hasPermissionOnUser(userId, "read_info", token.uid))) {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, "not found");
            }
        }
        return result;
    }

    async updateUser(userId: string, update: Partial<User> & { id: string }): Promise<User> {
        const user = await this.findUserById(userId, update.id);
        await this.authorizer.checkPermissionOnUser(userId, "write_info", user.id);

        //hang on to user profile before it's overwritten for analytics below
        const oldProfile = User.getProfile(user);

        const allowedFields: (keyof User)[] = ["fullName", "additionalData"];
        for (const p of allowedFields) {
            if (p in update) {
                (user[p] as any) = update[p];
            }
        }

        await this.userDb.updateUserPartial(user);

        //track event and user profile if profile of partialUser changed
        const newProfile = User.getProfile(user);
        if (User.Profile.hasChanges(oldProfile, newProfile)) {
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

    async setAdminRole(userId: string, targetUserId: string, admin: boolean): Promise<User> {
        await this.authorizer.checkPermissionOnUser(userId, "make_admin", targetUserId);
        const target = await this.findUserById(userId, targetUserId);
        const rolesAndPermissions = target.rolesOrPermissions || [];
        const newRoles = [...rolesAndPermissions.filter((r) => r !== "admin")];
        if (admin) {
            // add admin role
            newRoles.push("admin");
        }

        try {
            return await this.userDb.transaction(async (userDb) => {
                target.rolesOrPermissions = newRoles;
                const updatedUser = await userDb.storeUser(target);
                if (admin) {
                    await this.authorizer.addInstallationAdminRole(target.id);
                } else {
                    await this.authorizer.removeInstallationAdminRole(target.id);
                }
                return updatedUser;
            });
        } catch (err) {
            if (admin) {
                await this.authorizer.removeInstallationAdminRole(target.id);
            } else {
                await this.authorizer.addInstallationAdminRole(target.id);
            }
            throw err;
        }
    }
}
