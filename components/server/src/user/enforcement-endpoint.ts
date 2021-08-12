/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import { injectable, inject } from "inversify";
import { WorkspaceDB, UserDB } from '@gitpod/gitpod-db/lib';
import { User, GitpodClient, GitpodServer } from '@gitpod/gitpod-protocol';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Config } from '../config';
import { UserDeletionService } from '../user/user-deletion-service';
import { AuthorizationService } from './authorization-service';
import { Permission } from '@gitpod/gitpod-protocol/lib/permission';
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { GitpodServerImpl } from '../workspace/gitpod-server-impl';
import { ResourceAccessGuard, OwnerResourceGuard } from '../auth/resource-access';

export const EnforcementControllerServerFactory = Symbol('EnforcementControllerServerFactory');
export type EnforcementControllerServerFactory = () => GitpodServerImpl<GitpodClient, GitpodServer>;

@injectable()
export class EnforcementController {
    @inject(Config) protected readonly config: Config;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(UserDeletionService) protected readonly userDeletionService: UserDeletionService;
    @inject(AuthorizationService) protected readonly authService: AuthorizationService;
    @inject(EnforcementControllerServerFactory) private readonly serverFactory: EnforcementControllerServerFactory;

    get apiRouter(): express.Router {
        const router = express.Router();
        this.addRouteToBlockUser(router);
        this.addRouteToKillWorkspace(router);
        this.addRouteToDeleteUser(router);
        return router;
    }

    private createGitpodServer(user: User, resourceAccessGuard: ResourceAccessGuard) {
        /*
            This initialize call is a hack. GitpodServer is intended to be accessed via Wbsocket/JsonRpc (see WebsocketConnectionManager).
            Thus, initialize() needs a GitpodClient. For the methods we use here from GitpodServer we do not need this client.
            We re-use the GitpodServer to block a user in order to have one single point where the blocking logic is.
            Since we want to get rid of this enforcement endpoint in the long term having this hack does not harm and looking for
            another architecture is not necessary.
        */
        const server = this.serverFactory()
        server.initialize(undefined, user, resourceAccessGuard, undefined);
        return server;
    }

    protected getAuthorizedUser(req: express.Request): { callingUser: User, resourceAccessGuard: ResourceAccessGuard } | undefined {
        if (!req.isAuthenticated() || !req.user) {
            return;
        }

        const user = req.user as User;
        if (user.blocked) {
            return;
        }

        if (this.authService.hasPermission(user, Permission.ENFORCEMENT)) {
            return { callingUser: user, resourceAccessGuard: new OwnerResourceGuard(user.id) };
        } else {
            return undefined;
        }
    }

    protected addRouteToBlockUser(router: express.Router) {
        router.get("/block-user/:userid", async (req, res, next) => {
            const auth = this.getAuthorizedUser(req);
            if (!auth) {
                log.warn("Unauthorized user attempted to access enforcement endpoint", req);
                // don't tell the world we exist
                res.sendStatus(404);
                return;
            }

            const targetUserID = req.params.userid;
            const target = await this.userDB.findUserById(targetUserID);
            if (target && target.blocked) {
                res.send("User is already blocked");
                return;
            }

            const actionUrl = this.blockUserUrl(targetUserID as string);
            res.send(`<html><body><h1>Click button below</h1><p>User will be blocked and all running workspaces will be stopped.</p><form method="post" action="${actionUrl}"><input type="submit" value="Do it"></form></body></html>`);
        });
        router.post("/block-user/:userid", async (req, res, next) => {
            const auth = this.getAuthorizedUser(req);
            if (!auth) {
                log.warn("Unauthorized user attempted to access enforcement endpoint", req);
                // don't tell the world we exist
                res.sendStatus(404);
                return;
            }
            const { callingUser, resourceAccessGuard } = auth;

            const targetUserID = req.params.userid;
            const server = this.createGitpodServer(callingUser, resourceAccessGuard);
            try {
                await server.adminBlockUser({ id: targetUserID, blocked: true });
                res.sendStatus(200);
            } catch (e) {
                if (e instanceof ResponseError && e.code === ErrorCodes.NOT_FOUND) {
                    log.info({ userId: callingUser.id }, `Tried to block non-existent user id=${targetUserID}`);
                    res.status(404);
                    res.send(`User ${targetUserID} does not exist`);
                } else {
                    log.error({ userId: callingUser.id }, `Blocking failed user id=${targetUserID}`, e);
                    res.status(500);
                    res.send(e);
                }
            } finally {
                server.dispose();
            }
        });
    }

    protected addRouteToKillWorkspace(router: express.Router) {
        router.get("/kill-workspace/:wsid", async (req, res, next) => {
            const auth = this.getAuthorizedUser(req);
            if (!auth) {
                log.warn("Unauthorized user attempted to access enforcement endpoint", req);
                // don't tell the world we exist
                res.sendStatus(404);
                return;
            }

            const actionUrl = this.config.hostUrl.withApi({ pathname: `/enforcement/kill-workspace/${req.params.wsid}` }).toString();
            res.send(`<html><body><h1>Click button below</h1><form method="post" action="${actionUrl}"><input type="submit" value="Do it"></form></body></html>`)
        });
        router.post("/kill-workspace/:wsid", async (req, res, next) => {
            const auth = this.getAuthorizedUser(req);
            if (!auth) {
                log.warn("Unauthorized user attempted to access enforcement endpoint", req);
                // don't tell the world we exist
                res.sendStatus(404);
                return;
            }
            const { callingUser, resourceAccessGuard } = auth;

            const targetWsID = req.params.wsid;
            const server = this.createGitpodServer(callingUser, resourceAccessGuard);
            try {
                await server.adminForceStopWorkspace(targetWsID);

                const target = (await this.workspaceDb.findById(targetWsID))!;
                const owner = await this.userDB.findUserById(target!.ownerId);
                if (!owner) {
                    log.warn({ userId: callingUser.id }, `Owner ${target.ownerId} of workspace ${target.id} does not exist`);
                    res.status(404);
                    res.send(`Workspace owner ${target.ownerId} does not exist.`);
                    return;
                }

                const blockURL = this.blockUserUrl(owner.id);
                log.info({ userId: callingUser.id }, `Stopped workspace ${target.id} through enforcement endpoint`);
                res.status(200);
                res.send(`Workspace was stopped. Do you want to <a href="${blockURL}">block the user ${owner.id} immediately?</a>`);
            } catch (e) {
                if (e instanceof ResponseError && e.code === ErrorCodes.NOT_FOUND) {
                    log.info({ userId: callingUser.id }, `Tried to kill non-existent workspace id=${targetWsID}`);
                    res.status(404);
                    res.send(`Workspace ${targetWsID} does not exist`);
                } else {
                    log.error({ userId: callingUser.id }, `Stopping workspace failed workspace id=${targetWsID}`, e);
                    res.status(500);
                    res.send(e);
                }
            } finally {
                server.dispose()
            }
        });
    }

    protected addRouteToDeleteUser(router: express.Router) {
        router.get("/delete-user/:userid", async (req, res, next) => {
            const auth = this.getAuthorizedUser(req);
            if (!auth) {
                log.warn("Unauthorized user attempted to access enforcement endpoint", req);
                // don't tell the world we exist
                res.sendStatus(404);
                return;
            }

            const targetUserID = req.params.userid;
            const actionUrl = this.deleteUserUrl(targetUserID);
            res.send(`<html><body><h1>Click button below</h1><form method="post" action="${actionUrl}"><input type="submit" value="Do it"></form></body></html>`)
        });

        router.post("/delete-user/:userid", async (req, res, next) => {
            const auth = this.getAuthorizedUser(req);
            if (!auth) {
                log.warn("Unauthorized user attempted to access enforcement endpoint", req);
                // don't tell the world we exist
                res.sendStatus(404);
                return;
            }
            const { callingUser } = auth;

            const logCtx: LogContext = { userId: callingUser.id };
            const targetUserID = req.params.userid;
            try {
                log.info(logCtx, `Trying to delete user id=${targetUserID}...`, { action: 'delete-user', status: 'started' });
                await this.userDeletionService.deleteUser(targetUserID);
                log.info(logCtx, `Deleted user id=${targetUserID}.`, { action: 'delete-user', status: 'success' });
                res.sendStatus(200);
            } catch (err) {
                log.error(logCtx, `Tried to delete user id=${targetUserID}`, err, { action: 'delete-user', status: 'error' });
                res.status(404);
                const message = !!err && err.message ? err.message + '' : '<no message>';
                res.send(`An error occurred while deleting ${targetUserID}: ${message}`);
            }
        });
    }

    protected blockUserUrl(userId: string): string {
        return this.config.hostUrl.withApi({ pathname: `/enforcement/block-user/${userId}` }).toString();
    }

    protected deleteUserUrl(userId: string): string {
        return this.config.hostUrl.withApi({ pathname: `/enforcement/delete-user/${userId}` }).toString();
    }
}
