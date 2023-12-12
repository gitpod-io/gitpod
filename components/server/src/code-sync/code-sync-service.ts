/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { status } from "@grpc/grpc-js";
import fetch from "node-fetch";
import * as util from "util";
import express from "express";
import { inject, injectable } from "inversify";
import { BearerAuth } from "../auth/bearer-authenticator";
import { WithFunctionAccessGuard } from "../auth/function-access";
import { CodeSyncResourceDB, ALL_SERVER_RESOURCES, ServerResource, SyncResource } from "@gitpod/gitpod-db/lib";
import {
    DeleteRequest,
    DeleteResponse,
    DownloadUrlRequest,
    DownloadUrlResponse,
    UploadUrlRequest,
    UploadUrlResponse,
} from "@gitpod/content-service/lib/blobs_pb";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { v4 as uuidv4 } from "uuid";
import { accessCodeSyncStorage, UserRateLimiter } from "../auth/rate-limiter";
import { Config } from "../config";
import { CachingBlobServiceClientProvider } from "../util/content-service-sugar";
import { Authorizer } from "../authorization/authorizer";
import { FGAFunctionAccessGuard } from "../auth/resource-access";
import { runWithReqSubjectId } from "../auth/express";
import { ctxSubjectId, ctxUserId } from "../util/request-context";

// By default: 5 kind of resources * 20 revs * 1Mb = 100Mb max in the content service for user data.
const defaultRevLimit = 20;
// It should keep it aligned with client_max_body_size for /code-sync location.
const defaultContentLimit = "1Mb";
export type CodeSyncConfig = Partial<{
    revLimit: number;
    contentLimit: number;
    resources: {
        [resource: string]: {
            revLimit?: number;
        };
    };
}>;

function getBasePrefix(resource: ServerResource, collection: string | undefined) {
    if (resource === "editSessions") {
        return "edit-sessions/";
    } else if (collection) {
        return "code-sync-collection/";
    } else {
        return "code-sync/";
    }
}

function toObjectName(resource: ServerResource, rev: string, collection: string | undefined): string {
    let name = getBasePrefix(resource, collection);
    if (collection) {
        if (collection === "all") {
            return name;
        }
        name += collection + "/";
    }

    name += resource + "/";
    if (rev === "all") {
        return name;
    }
    name += rev;

    return name;
}

@injectable()
export class CodeSyncService {
    constructor(
        @inject(Config)
        private readonly config: Config,

        @inject(BearerAuth)
        private readonly auth: BearerAuth,

        @inject(CachingBlobServiceClientProvider)
        private readonly blobsProvider: CachingBlobServiceClientProvider,

        @inject(CodeSyncResourceDB)
        private readonly db: CodeSyncResourceDB,

        @inject(Authorizer)
        private readonly authorizer: Authorizer,
    ) {}

    get apiRouter(): express.Router {
        const config = this.config.codeSync;
        const router = express.Router();
        router.use((_, res, next) => {
            // to correlate errors reported by users with errors logged by the server
            res.setHeader("x-operation-id", uuidv4());
            return next();
        });
        router.use(this.auth.restHandler); // expects Bearer token and authenticates req.user, throws otherwise
        router.use(runWithReqSubjectId());
        router.use(async (req, res, next) => {
            const userId = getUserId(req);
            if (!userId) {
                res.sendStatus(400);
                return;
            }

            try {
                await UserRateLimiter.instance(this.config.rateLimiter).consume(
                    ctxSubjectId().toString(),
                    accessCodeSyncStorage,
                );
            } catch (e) {
                if (e instanceof Error) {
                    throw e;
                }
                res.setHeader("Retry-After", String(Math.round(e.msBeforeNext / 1000)) || 1);
                res.status(429).send("Too Many Requests");
                return;
            }

            const functionGuard = (req as WithFunctionAccessGuard).functionGuard;
            if (!!functionGuard) {
                // If we authorize with scopes, there is a FunctionGuard
                const guard = new FGAFunctionAccessGuard(userId, functionGuard);
                if (!(await guard.canAccess(accessCodeSyncStorage))) {
                    res.sendStatus(403);
                    return;
                }
            }

            if (!(await this.authorizer.hasPermissionOnUser(ctxSubjectId(), "code_sync", userId))) {
                res.sendStatus(403);
                return;
            }

            return next();
        });

        router.get("/v1/manifest", async (req, res) => {
            const manifest = await this.db.getManifest(getUserId(req));
            if (!manifest) {
                res.sendStatus(204);
                return;
            }
            res.json(manifest);
            return;
        });

        router.get("/v1/collection/:collection/resource/:resource", this.getResources.bind(this));
        router.get("/v1/resource/:resource", this.getResources.bind(this));
        router.get("/v1/collection/:collection/resource/:resource/:ref", this.getResource.bind(this));
        router.get("/v1/resource/:resource/:ref", this.getResource.bind(this));
        router.post(
            "/v1/collection/:collection/resource/:resource",
            express.text({ limit: config?.contentLimit || defaultContentLimit }),
            this.postResource.bind(this),
        );
        router.post(
            "/v1/resource/:resource",
            express.text({ limit: config?.contentLimit || defaultContentLimit }),
            this.postResource.bind(this),
        );
        router.delete("/v1/collection/:collection/resource/:resource/:ref?", this.deleteResource.bind(this));
        router.delete("/v1/resource/:resource/:ref?", this.deleteResource.bind(this));
        router.delete("/v1/resource", async (req, res) => {
            // This endpoint is used to delete settings-sync data only
            const userId = getUserId(req);
            await this.db.deleteSettingsSyncResources(userId, async () => {
                const request = new DeleteRequest();
                request.setOwnerId(userId);
                request.setPrefix(getBasePrefix(SyncResource.GlobalState, undefined));
                try {
                    const blobsClient = this.blobsProvider.getDefault();
                    await util.promisify(blobsClient.delete.bind(blobsClient))(request);
                } catch (e) {
                    log.error({ userId }, "code sync: failed to delete", e);
                }
            });
            res.sendStatus(200);

            return;
        });

        router.get("/v1/collection", async (req, res) => {
            const collections = await this.db.getCollections(getUserId(req));

            res.json(collections);
            return;
        });
        router.post("/v1/collection", async (req, res) => {
            const collection = await this.db.createCollection(getUserId(req));

            res.type("text/plain");
            res.send(collection);
            return;
        });
        router.delete("/v1/collection/:collection?", async (req, res) => {
            const { collection } = req.params;
            await this.deleteCollection(getUserId(req), collection);

            res.sendStatus(200);
        });

        return router;
    }

    private async getResources(req: express.Request<{ resource: string; collection?: string }>, res: express.Response) {
        const { resource, collection } = req.params;
        const resourceKey = ALL_SERVER_RESOURCES.find((key) => key === resource);
        if (!resourceKey) {
            res.sendStatus(400);
            return;
        }

        if (collection) {
            const valid = await this.db.isCollection(getUserId(req), collection);
            if (!valid) {
                res.sendStatus(405);
                return;
            }
        }

        const revs = await this.db.getResources(getUserId(req), resourceKey, collection);
        if (!revs.length) {
            res.sendStatus(204);
            return;
        }

        const result: { url: string; created: number }[] = revs.map((e) => ({
            url: req.originalUrl + "/" + e.rev,
            created: Date.parse(e.created) / 1000 /* client expects in seconds */,
        }));
        res.json(result);
        return;
    }

    private async getResource(
        req: express.Request<{ resource: string; ref: string; collection?: string }>,
        res: express.Response,
    ) {
        const { resource, ref, collection } = req.params;
        const resourceKey = ALL_SERVER_RESOURCES.find((key) => key === resource);
        if (!resourceKey) {
            res.sendStatus(400);
            return;
        }

        if (collection) {
            const valid = await this.db.isCollection(getUserId(req), collection);
            if (!valid) {
                res.sendStatus(405);
                return;
            }
        }

        const resourceRev = (await this.db.getResource(getUserId(req), resourceKey, ref, collection))?.rev;
        if (!resourceRev) {
            res.setHeader("etag", "0");
            res.sendStatus(204);
            return;
        }
        if (req.headers["if-none-match"] === resourceRev) {
            res.sendStatus(304);
            return;
        }

        let content: string;
        const contentType = req.headers["content-type"] || "*/*";
        const request = new DownloadUrlRequest();
        request.setOwnerId(getUserId(req));
        request.setName(toObjectName(resourceKey, resourceRev, collection));
        request.setContentType(contentType);
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
                throw new Error(
                    `code sync: blob service: download failed with ${response.status} ${response.statusText}`,
                );
            }
            content = await response.text();
        } catch (e) {
            if (e.code === status.NOT_FOUND) {
                res.sendStatus(204);
                return;
            }
            throw e;
        }

        res.setHeader("etag", resourceRev);
        res.type("text/plain");
        res.send(content);
    }

    private async postResource(req: express.Request<{ resource: string; collection?: string }>, res: express.Response) {
        const { resource, collection } = req.params;
        const resourceKey = ALL_SERVER_RESOURCES.find((key) => key === resource);
        if (!resourceKey) {
            res.sendStatus(400);
            return;
        }

        if (collection) {
            const valid = await this.db.isCollection(getUserId(req), collection);
            if (!valid) {
                res.sendStatus(405);
                return;
            }
        }

        const latestRev: string | undefined = req.headers["if-match"];

        const revLimit =
            resourceKey === "machines"
                ? 1
                : this.config.codeSync.resources?.[resourceKey]?.revLimit ||
                  this.config.codeSync?.revLimit ||
                  defaultRevLimit;
        const isEditSessionsResource = resourceKey === "editSessions";
        const userId = getUserId(req);
        const contentType = req.headers["content-type"] || "*/*";
        const newRev = await this.db.insert(
            userId,
            resourceKey,
            collection,
            latestRev,
            async (rev, oldRevs) => {
                const request = new UploadUrlRequest();
                request.setOwnerId(userId);
                request.setName(toObjectName(resourceKey, rev, collection));
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
                if (response.status !== 200) {
                    throw new Error(
                        `code sync: blob service: upload failed with ${response.status} ${response.statusText}`,
                    );
                }

                if (oldRevs.length) {
                    // Asynchonously delete old revs from storage
                    Promise.allSettled(
                        oldRevs.map((rev) => this.doDeleteResource(userId, resourceKey, rev, collection)),
                    ).catch(() => {});
                }
            },
            { revLimit, overwrite: !isEditSessionsResource },
        );

        if (!newRev) {
            res.sendStatus(isEditSessionsResource ? 400 : 412);
            return;
        }

        res.setHeader("etag", newRev);
        res.sendStatus(200);
        return;
    }

    private async deleteResource(
        req: express.Request<{ resource: string; ref?: string; collection?: string }>,
        res: express.Response,
    ) {
        // This endpoint is used to delete edit sessions data for now

        const { resource, ref, collection } = req.params;
        const resourceKey = ALL_SERVER_RESOURCES.find((key) => key === resource);
        if (!resourceKey) {
            res.sendStatus(400);
            return;
        }

        if (collection) {
            const valid = await this.db.isCollection(getUserId(req), collection);
            if (!valid) {
                res.sendStatus(405);
                return;
            }
        }

        await this.doDeleteResource(getUserId(req), resourceKey, ref, collection);
        res.sendStatus(200);
        return;
    }

    private async doDeleteResource(
        userId: string,
        resourceKey: ServerResource,
        rev: string | undefined,
        collection: string | undefined,
    ) {
        try {
            await this.db.deleteResource(userId, resourceKey, rev, collection, async (rev?: string) => {
                try {
                    const request = new DeleteRequest();
                    request.setOwnerId(userId);
                    if (rev) {
                        request.setExact(toObjectName(resourceKey, rev, collection));
                    } else {
                        request.setPrefix(toObjectName(resourceKey, "all", collection));
                    }
                    const blobsClient = this.blobsProvider.getDefault();
                    await util.promisify<DeleteRequest, DeleteResponse>(blobsClient.delete.bind(blobsClient))(request);
                } catch (e) {
                    if (e.code === status.NOT_FOUND) {
                        return;
                    }
                    throw e;
                }
            });
        } catch (e) {
            if (rev) {
                log.error({ userId }, "code sync: failed to delete obj", e, {
                    object: toObjectName(resourceKey, rev, collection),
                });
            } else {
                log.error({ userId }, "code sync: failed to delete", e);
            }
            throw e;
        }
    }

    private async deleteCollection(userId: string, collection: string | undefined) {
        try {
            await this.db.deleteCollection(userId, collection, async (collection?: string) => {
                try {
                    const request = new DeleteRequest();
                    request.setOwnerId(userId);
                    request.setPrefix(toObjectName(SyncResource.GlobalState, "all", collection ?? "all"));
                    const blobsClient = this.blobsProvider.getDefault();
                    await util.promisify<DeleteRequest, DeleteResponse>(blobsClient.delete.bind(blobsClient))(request);
                } catch (e) {
                    if (e.code === status.NOT_FOUND) {
                        return;
                    }
                    throw e;
                }
            });
        } catch (e) {
            log.error({ userId }, "code sync: failed to delete collections", e);
            throw e;
        }
    }
}

function getUserId(req: express.Request): string {
    return ctxUserId(); // TODO(gpl) Is there a way to pass this as parameter, so we can use a token later on?
}
