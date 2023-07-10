/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import fetch from "node-fetch";
import { User } from "@gitpod/gitpod-protocol/lib/protocol";
import * as util from "util";
import * as express from "express";
import { inject, injectable } from "inversify";
import { BearerAuth } from "../auth/bearer-authenticator";
import { isWithFunctionAccessGuard } from "../auth/function-access";
import {
    DownloadUrlRequest,
    DownloadUrlResponse,
    UploadUrlRequest,
    UploadUrlResponse,
} from "@gitpod/content-service/lib/blobs_pb";
import { accessShellHistoryStorage, UserRateLimiter } from "../auth/rate-limiter";
import { Config } from "../config";
import { CachingBlobServiceClientProvider } from "../util/content-service-sugar";

const defaultContentLimit = "1Mb";
const supportShells = ["bash", "zsh", "fish"];

function toObjectName(shell: string, host: string, repo: string): string {
    return `shell-history/${host}/${encodeURIComponent(repo)}/${shell}`;
}

@injectable()
export class ShellHistoryService {
    @inject(Config)
    private readonly config: Config;

    @inject(BearerAuth)
    private readonly auth: BearerAuth;

    @inject(CachingBlobServiceClientProvider)
    private readonly blobsProvider: CachingBlobServiceClientProvider;

    get apiRouter(): express.Router {
        const router = express.Router();
        router.use(this.auth.restHandler);
        router.use(async (req, res, next) => {
            if (!User.is(req.user)) {
                res.sendStatus(400);
                return;
            }

            const id = req.user.id;
            try {
                await UserRateLimiter.instance(this.config.rateLimiter).consume(id, accessShellHistoryStorage);
            } catch (e) {
                if (e instanceof Error) {
                    throw e;
                }
                res.setHeader("Retry-After", String(Math.round(e.msBeforeNext / 1000)) || 1);
                res.status(429).send("Too Many Requests");
                return;
            }

            // TODO:(add check for context repo)
            if (!isWithFunctionAccessGuard(req) || !req.functionGuard?.canAccess(accessShellHistoryStorage)) {
                res.sendStatus(403);
                return;
            }
            return next();
        });

        router.get("/v1/:shell/:host/:repo(*)", this.getResources.bind(this));
        router.post(
            "/v1/:shell/:host/:repo(*)",
            express.text({ limit: defaultContentLimit }),
            this.postResource.bind(this),
        );

        return router;
    }

    private async getResources(
        req: express.Request<{ shell: string; host: string; repo: string }>,
        res: express.Response,
    ) {
        if (!User.is(req.user)) {
            res.sendStatus(400);
            return;
        }

        const { shell, host, repo } = req.params;

        const resourceKey = supportShells.find((key) => key === shell);
        if (!resourceKey) {
            res.sendStatus(400);
            return;
        }

        const contentType = req.headers["content-type"] || "*/*";
        const request = new DownloadUrlRequest();
        request.setOwnerId(req.user.id);
        request.setName(toObjectName(shell, host, repo));
        request.setContentType(contentType);
        let content: string;
        try {
            const blobsClient = this.blobsProvider.getDefault();
            const urlResponse = await util.promisify<DownloadUrlRequest, DownloadUrlResponse>(
                blobsClient.downloadUrl.bind(blobsClient),
            )(request);
            const response = await fetch(urlResponse.getUrl(), {
                timeout: 10000,
                headers: {
                    "content-type": contentType,
                },
            });
            if (response.status !== 200) {
                res.sendStatus(response.status);
                return;
            }
            content = await response.text();
        } catch (e) {
            throw e;
        }

        res.type("text/plain");
        res.send(content);
        return;
    }

    private async postResource(
        req: express.Request<{ shell: string; host: string; repo: string }>,
        res: express.Response,
    ) {
        if (!User.is(req.user)) {
            res.sendStatus(400);
            return;
        }

        const { shell, host, repo } = req.params;

        const resourceKey = supportShells.find((key) => key === shell);
        if (!resourceKey) {
            res.sendStatus(400);
            return;
        }

        const userId = req.user.id;
        const contentType = req.headers["content-type"] || "*/*";

        const request = new UploadUrlRequest();
        request.setOwnerId(userId);
        request.setName(toObjectName(shell, host, repo));
        request.setContentType(contentType);
        const blobsClient = this.blobsProvider.getDefault();
        const urlResponse = await util.promisify<UploadUrlRequest, UploadUrlResponse>(
            blobsClient.uploadUrl.bind(blobsClient),
        )(request);
        const url = urlResponse.getUrl();
        const content = req.body as string;
        const response = await fetch(url, {
            timeout: 10000,
            method: "PUT",
            body: content,
            headers: {
                "content-length": req.headers["content-length"] || String(content.length),
                "content-type": contentType,
            },
        });
        res.sendStatus(response.status);
        return;
    }
}
