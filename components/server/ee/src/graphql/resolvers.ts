/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { Permission, PermissionName, User } from '@gitpod/gitpod-protocol';
import { inject, injectable } from "inversify";
import { AuthorizationService } from "../../../src/user/authorization-service";
import { Context } from "./graphql-controller";
import { Resolvers } from "./graphql-gen";

@injectable()
export class GraphQLResolvers {

    @inject(UserDB)
    protected readonly userDb: UserDB;

    @inject(WorkspaceDB)
    protected readonly workspaceDb: WorkspaceDB;

    @inject(AuthorizationService)
    protected readonly authorizationService: AuthorizationService;

    get(): Resolvers {
        return {
            Query: {
                me: this.authenticated(
                    (_, _args, ctx) => ctx.user!
                ),
                user: this.admin(
                    (_, { userId }, _ctx) => this.userDb.findUserById(userId)
                ),
                users: this.admin(
                    async (_, { offset, limit, orderBy, orderDir, searchTerm, minCreationDate, maxCreationDate }, _ctx) => {
                        const { total, rows } = await this.userDb.findAllUsers(offset, limit, orderBy, orderDir, searchTerm, parseMaybeDate(minCreationDate), parseMaybeDate(maxCreationDate), true);
                        return { items: rows, total, hasMore: offset + limit < total };
                    }
                ),
                userCount: this.admin(
                    (_, _args, _ctx) => this.userDb.getUserCount(true)
                ),
                workspaces: this.admin(
                    async (_, { offset, limit, orderBy, orderDir, ownerId, searchTerm, minCreationTime, maxCreationTime, type }, _ctx) => {
                        const { total, rows } = await this.workspaceDb.findAllWorkspaces(offset, limit, orderBy, orderDir, ownerId, searchTerm, parseMaybeDate(minCreationTime), parseMaybeDate(maxCreationTime), type);
                        return { items: rows, total, hasMore: offset + limit < total };
                    }
                ),
                workspaceInstances: this.admin(
                    async (_, { offset, limit, orderBy, orderDir, ownerId, minCreationTime, maxCreationTime, onlyRunning, type }, _ctx) => {
                        const { total, rows } = await this.workspaceDb.findAllWorkspaceInstances(offset, limit, orderBy, orderDir, ownerId, parseMaybeDate(minCreationTime), parseMaybeDate(maxCreationTime), onlyRunning, type);
                        return { items: rows, total, hasMore: offset + limit < total };
                    }
                ),
            },
            User: {
                displayName: (user, _args, _ctx) => User.getName(user),
                email: (user, _args, _ctx) => User.getPrimaryEmail(user),
                workspaces: (user, _args, _ctx) => this.workspaceDb.findWorkspacesByUser(user.id),
                deleted: (user, _args, _ctx) => user.markedDeleted,
            },
            Workspace: {
                owner: (workspace, _args, _ctx) => this.userDb.findUserById(workspace.ownerId).then(owner => owner!),
                instances: (workspace, _args, _ctx) => this.workspaceDb.findInstances(workspace.id),
            },
            WorkspaceInstance: {
                workspace: (workspaceInstance, _args, _ctx) => {
                    if (workspaceInstance.hasOwnProperty("workspace")) {
                        // we re-use the existing workspace instance that was attached by TypeORM in order to avoid an additional DB query
                        return (workspaceInstance as any).workspace;
                    } else {
                        return this.workspaceDb.findById(workspaceInstance.workspaceId);
                    }
                },
            },
        };
    }

    protected authenticated<T1, T2, T3 extends Context, T4, T5>(next: (root: T1, args: T2, ctx: T3, info: T4) => T5): (root: T1, args: T2, ctx: T3, info: T4) => T5 {
        return (root: T1, args: T2, ctx: T3, info: T4) => {
            if (!ctx.user) {
                throw new Error("Unauthenticated");
            }
            return next(root, args, ctx, info);
        }
    }

    protected authorized<T1, T2, T3 extends Context, T4, T5>(permission: PermissionName, next: (root: T1, args: T2, ctx: T3, info: T4) => T5): (root: T1, args: T2, ctx: T3, info: T4) => T5 {
        return this.authenticated((root: T1, args: T2, ctx: T3, info: T4) => {
            if (!this.authorizationService.hasPermission(ctx.user!, permission)) {
                throw new Error("Unauthorized access");
            }
            return next(root, args, ctx, info);
        });
    }

    protected admin<T1, T2, T3 extends Context, T4, T5>(next: (root: T1, args: T2, ctx: T3, info: T4) => T5): (root: T1, args: T2, ctx: T3, info: T4) => T5 {
        return this.authorized(Permission.ADMIN_API, next);
    }
}

function parseMaybeDate(date: string | undefined) {
    return date ? new Date(date) : undefined;
}
