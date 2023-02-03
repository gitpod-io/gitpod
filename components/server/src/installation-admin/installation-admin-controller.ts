/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as crypto from "crypto";
import { injectable, inject } from "inversify";
import * as express from "express";
import * as opentracing from "opentracing";
import { InstallationAdminTelemetryDataProvider } from "./telemetry-data-provider";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { OneTimeSecretServer } from "../one-time-secret-server";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID, UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { Config } from "../config";

@injectable()
export class InstallationAdminController {
    @inject(InstallationAdminTelemetryDataProvider)
    protected readonly telemetryDataProvider: InstallationAdminTelemetryDataProvider;

    @inject(OneTimeSecretServer)
    protected readonly otsServer: OneTimeSecretServer;

    @inject(Config)
    protected readonly config: Config;

    @inject(UserDB)
    protected readonly userDb: UserDB;

    public create(): express.Application {
        const app = express();

        app.get("/data", async (req: express.Request, res: express.Response) => {
            const spanCtx =
                opentracing.globalTracer().extract(opentracing.FORMAT_HTTP_HEADERS, req.headers) || undefined;
            const span = opentracing.globalTracer().startSpan("telemetryDataEndpoint", { childOf: spanCtx });
            try {
                res.status(200).json(await this.telemetryDataProvider.getTelemetryData());
            } finally {
                span.finish();
            }
        });

        const adminUserCreateLoginTokenRoute = "/admin-user/login-token/create";
        app.post(adminUserCreateLoginTokenRoute, async (req: express.Request, res: express.Response) => {
            const span = TraceContext.startSpan(adminUserCreateLoginTokenRoute);
            const ctx = { span };

            log.info(`${adminUserCreateLoginTokenRoute} received.`);
            try {
                // In case there is no/an empty key specified: Nobody should be able to call this so they are not able to guess values here
                if (!this.config.admin.loginKey) {
                    throw new Error("Cannot handle request");
                }

                // Unblock the admin-user: it's blocked initially!
                const user = await this.userDb.findUserById(BUILTIN_INSTLLATION_ADMIN_USER_ID);
                if (!user) {
                    throw new Error("Cannot find builtin admin-user");
                }
                user.blocked = false;
                await this.userDb.storeUser(user);

                // Create a fresh token
                // TODO(gpl): Would be nice if we could invalidate all other tokens here!
                const secretHash = crypto
                    .createHash("sha256")
                    .update(BUILTIN_INSTLLATION_ADMIN_USER_ID + this.config.admin.loginKey)
                    .digest("hex");
                const oneDay = new Date();
                oneDay.setDate(oneDay.getDate() + 1);
                const ots = await this.otsServer.serveToken(ctx, secretHash, oneDay);

                res.send(ots.token).status(200);
                log.info(`${adminUserCreateLoginTokenRoute} done.`);
            } catch (err) {
                TraceContext.setError(ctx, err);
                span.finish();
                log.error(`${adminUserCreateLoginTokenRoute} error`, err);
                res.sendStatus(500);
            }
        });

        return app;
    }
}
