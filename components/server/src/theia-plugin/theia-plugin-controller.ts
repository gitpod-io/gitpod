/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as express from 'express';
import { injectable, inject } from "inversify";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { UserDB, TheiaPluginDB } from '@gitpod/gitpod-db/lib';
import { Env } from '../env';
import { TheiaPluginService } from './theia-plugin-service';
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';

@injectable()
export class TheiaPluginController {
    @inject(Env) protected readonly env: Env;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TheiaPluginDB) protected readonly pluginDB: TheiaPluginDB;
    @inject(TheiaPluginService) protected readonly pluginService: TheiaPluginService;

    get apiRouter(): express.Router {
        const router = express.Router();
        this.addPreflightHandler(router);
        return router;
    }

    protected addPreflightHandler(router: express.Router) {

        /**
         * The preflight subrequest is done by the proxy (cf. lib.gitpod-plugin.conf) to authorize
         * the upload, prepare the upload, and request the signed URL to upload the file.
         */
        router.get("/preflight", async (req, res, next) => {
            const token = req.query.token || req.headers["token"] || "unauthorized";
            if (this.env.serverProxyApiKey != token) {
                log.warn("Unauthorized attempted to access the /plugins/preflight endpoint", req);
                res.sendStatus(401);
                return;
            }

            // created in `TheiaPluginService.preparePluginUpload` (component/server)
            const id = req.query.id || req.headers["id"];
            const type = req.query.type || req.headers["type"];
            if (!id || (type != "upload" && type != "download")) {
                log.error("Missing params for /plugins/preflight", { req });
                res.sendStatus(400);
                return;
            }

            try {
                const url = await this.pluginService.preflight(id, type);
                res.send(url);
            } catch (err) {
                log.warn("Upload failed (Step: preflight)", err, { req });

                if (err instanceof ResponseError && err.code == ErrorCodes.CONFLICT) {
                    res.sendStatus(409);
                    return
                }
                res.sendStatus(400);
            }
        });

        router.get("/checkin", async (req, res, next) => {
            const token = req.query.token || req.headers["token"] || "unauthorized";
            if (this.env.serverProxyApiKey != token) {
                log.warn("Unauthorized attempted to access the /plugins/checkin endpoint", req);
                res.sendStatus(401);
                return;
            }

            // created in `TheiaPluginService.preparePluginUpload` (component/server)
            const id = req.query.id || req.headers["id"];
            const checkin = req.query.checkin || req.headers["checkin"];
            if (!id || checkin != "true") {
                log.error("Missing params for /plugins/checkin", { req });
                res.sendStatus(400);
                return;
            }

            try {
                const pluginId = await this.pluginService.checkin(id);
                res.status(200).send(pluginId);
            } catch (err) {
                log.warn("Upload failed (Step: checkin)", err, { req });
                res.sendStatus(400);
                return;
            }
        });
    }


}
