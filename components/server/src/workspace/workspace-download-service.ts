/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as express from "express";
import { TracedWorkspaceDB, DBWithTracing, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Permission, User } from "@gitpod/gitpod-protocol";
import { StorageClient } from "../storage/storage-client";
import { AuthorizationService } from "../user/authorization-service";

@injectable()
export class WorkspaceDownloadService {
    @inject(TracedWorkspaceDB) protected readonly workspaceDB: DBWithTracing<WorkspaceDB>;
    @inject(StorageClient) protected readonly storageClient: StorageClient;
    @inject(AuthorizationService) protected readonly authorizationService: AuthorizationService;

    get apiRouter(): express.Router {
        const router = express.Router();
        this.addDownloadHandler(router);
        return router;
    }

    protected addDownloadHandler(router: express.Router) {
        router.get("/get/:id", async (req, res, next) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                res.sendStatus(500);
                return;
            }
            const userId = req.user.id;

            const workspaceId = req.params.id;
            try {
                const wsi = await this.workspaceDB.trace({}).findWorkspaceAndInstance(workspaceId);
                if (!wsi || !!wsi.deleted || !!wsi.softDeleted) {
                    res.sendStatus(404);
                    return;
                }

                if (
                    wsi.ownerId !== userId &&
                    !this.authorizationService.hasPermission(req.user, Permission.ADMIN_WORKSPACE_CONTENT)
                ) {
                    log.warn({ workspaceId, userId }, "user attempted to download someone else's workspace");
                    res.sendStatus(500);
                    return;
                }

                const signedUrl = await this.storageClient.createWorkspaceContentDownloadUrl(userId, workspaceId);

                log.info({ workspaceId, userId }, "user is downloading workspace content");
                res.send(signedUrl);
            } catch (err) {
                log.error({ workspaceId }, "cannot prepare workspace download", err);
                res.sendStatus(500);
            }
        });
    }
}
