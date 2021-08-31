/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as express from 'express';
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { OneTimeSecretDB, DBWithTracing, TracedOneTimeSecretDB } from "@gitpod/gitpod-db/lib";
import { Disposable } from "@gitpod/gitpod-protocol";
import * as opentracing from 'opentracing';
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { Config } from "./config";

@injectable()
export class OneTimeSecretServer implements Disposable {
    @inject(Config) protected readonly config: Config;
    @inject(TracedOneTimeSecretDB) protected readonly oneTimeSecretDB: DBWithTracing<OneTimeSecretDB>;

    protected pruneTimeout: NodeJS.Timeout | undefined;

    public startPruningExpiredSecrets() {
        this.pruneTimeout = setInterval(() => this.oneTimeSecretDB.trace({}).pruneExpired(), 5*60*1000);
    }

    dispose(): void {
        if (!this.pruneTimeout) {
            return;
        }

        clearInterval(this.pruneTimeout);
        this.pruneTimeout = undefined;
    }

    get apiRouter(): express.Router {
        const router = express.Router();
        this.addHandler(router);
        return router;
    }

    protected addHandler(router: express.Router) {
        router.get("/ots/get/:id", async (req, res, next) => {
            const spanCtx = opentracing.globalTracer().extract(opentracing.FORMAT_HTTP_HEADERS, req.headers) || undefined;
            const span = opentracing.globalTracer().startSpan("getOneTimeSecret", {childOf: spanCtx});

            try {
                const key = req.params.id;
                const secret = await this.oneTimeSecretDB.trace({span}).get(key);
                if (!secret) {
                    res.sendStatus(404);
                    return;
                }

                log.info(`provided secret ${key}`);
                res.status(200).send(secret);
            } catch (err) {
                log.error("cannot provide one-time secret", err);
                res.sendStatus(500);
                TraceContext.logError({ span }, err);
            } finally {
                span.finish();
            }
        });
    }

    /**
     * serve registers a secret for one-time servance.
     *
     * @param secret the secret to serve once
     * @param expirationTime time until which the secret is available
     * @returns the URL under which the secret is available
     */
    public async serve(ctx: TraceContext, secret: string, expirationTime: Date): Promise<{token: string, disposable: Disposable}> {
        const key = await this.oneTimeSecretDB.trace(ctx).register(secret, expirationTime);
        const token = this.config.hostUrl.withApi({ pathname: `/ots/get/${key}` }).toString();
        const disposable: Disposable = {
            dispose: () => this.oneTimeSecretDB.trace({}).remove(key)
        };
        return { token, disposable };
    }

}