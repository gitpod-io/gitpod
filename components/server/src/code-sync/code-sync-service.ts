/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { status, ServiceError } from '@grpc/grpc-js';
import fetch from "node-fetch";
import { User } from '@gitpod/gitpod-protocol/lib/protocol';
import bodyParser = require('body-parser');
import * as util from 'util';
import * as express from 'express';
import { inject, injectable } from 'inversify';
import { BearerAuth } from '../auth/bearer-authenticator';
import { isWithFunctionAccessGuard } from '../auth/function-access';
import { CodeSyncResourceDB, UserStorageResourcesDB, ALL_SERVER_RESOURCES, ServerResource, SyncResource } from '@gitpod/gitpod-db/lib';
import { DeleteRequest, DownloadUrlRequest, DownloadUrlResponse, UploadUrlRequest, UploadUrlResponse } from '@gitpod/content-service/lib/blobs_pb';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { v4 as uuidv4 } from 'uuid';
import { accessCodeSyncStorage, UserRateLimiter } from '../auth/rate-limiter';
import { increaseApiCallUserCounter } from '../prometheus-metrics';
import { TheiaPluginService } from '../theia-plugin/theia-plugin-service';
import { Config } from '../config';
import { CachingBlobServiceClientProvider } from '@gitpod/content-service/lib/sugar';

// By default: 5 kind of resources * 20 revs * 1Mb = 100Mb max in the content service for user data.
const defautltRevLimit = 20;
// It should keep it aligned with client_max_body_size for /code-sync location.
const defaultContentLimit = '1Mb';
export type CodeSyncConfig = Partial<{
    revLimit: number
    contentLimit: number
    resources: {
        [resource: string]: {
            revLimit?: number
        }
    }
}>;

const objectPrefix = 'code-sync/';
function toObjectName(resource: ServerResource, rev: string): string {
    return objectPrefix + resource + '/' + rev;
}

const fromTheiaRev = 'from-theia';
interface ISyncData {
    version: number;
    machineId?: string;
    content: string;
}
interface ISettingsSyncContent {
    settings: string;
}
const userSettingsUri = 'user_storage:settings.json';

@injectable()
export class CodeSyncService {

    @inject(Config)
    private readonly config: Config;

    @inject(BearerAuth)
    private readonly auth: BearerAuth;

    @inject(CachingBlobServiceClientProvider)
    private readonly blobsProvider: CachingBlobServiceClientProvider;

    @inject(CodeSyncResourceDB)
    private readonly db: CodeSyncResourceDB;

    @inject(TheiaPluginService)
    private readonly theiaPluginService: TheiaPluginService;

    @inject(UserStorageResourcesDB)
    private readonly userStorageResourcesDB: UserStorageResourcesDB;

    get apiRouter(): express.Router {
        const config = this.config.codeSync;
        const router = express.Router();
        router.use((_, res, next) => {
            // to correlate errors reported by users with errors logged by the server
            res.setHeader('x-operation-id', uuidv4());
            return next();
        });
        router.use(this.auth.restHandler);
        router.use(async (req, res, next) => {
            if (!User.is(req.user)) {
                res.sendStatus(204);
                return;
            }

            const id = req.user.id;
            increaseApiCallUserCounter(accessCodeSyncStorage, id);
            try {
                await UserRateLimiter.instance(this.config.rateLimiter).consume(id, accessCodeSyncStorage);
            } catch (e) {
                if (e instanceof Error) {
                    throw e;
                }
                res.setHeader('Retry-After', String(Math.round(e.msBeforeNext / 1000)) || 1);
                res.status(429).send('Too Many Requests');
                return;
            }

            if (!isWithFunctionAccessGuard(req) || !req.functionGuard?.canAccess(accessCodeSyncStorage)) {
                res.sendStatus(403);
                return;
            }
            return next();
        });
        router.get('/v1/manifest', async (req, res) => {
            if (!User.is(req.user)) {
                res.sendStatus(204);
                return;
            }
            const manifest = await this.db.getManifest(req.user.id);
            if (!manifest.latest.extensions) {
                manifest.latest.extensions = fromTheiaRev;
            }
            if (!manifest.latest.settings) {
                manifest.latest.settings = fromTheiaRev;
            }
            res.json(manifest);
            return;
        });
        router.get('/v1/resource/:resource', async (req, res) => {
            if (!User.is(req.user)) {
                res.sendStatus(204);
                return;
            }
            const resourceKey = ALL_SERVER_RESOURCES.find(key => key === req.params.resource);
            const revs = resourceKey && await this.db.getResources(req.user.id, resourceKey)
            if (!revs || !revs.length) {
                res.sendStatus(204);
                return;
            }
            const result: { url: string, created: number }[] = revs.map(e => ({
                url: req.originalUrl + '/' + e.rev,
                created: Date.parse(e.created) / 1000 /* client expects in secondsm */
            }));
            res.json(result);
            return;
        });
        router.get('/v1/resource/:resource/:ref', async (req, res) => {
            if (!User.is(req.user)) {
                res.sendStatus(204);
                return;
            }
            const resourceKey = ALL_SERVER_RESOURCES.find(key => key === req.params.resource);
            if (!resourceKey) {
                res.sendStatus(204);
                return;
            }
            let resourceRev: string | undefined = req.params.ref;
            if (resourceRev !== fromTheiaRev) {
                resourceRev = (await this.db.getResource(req.user.id, resourceKey, resourceRev))?.rev;
            }
            if (!resourceRev && (resourceKey === SyncResource.Extensions || resourceKey === SyncResource.Settings)) {
                resourceRev = fromTheiaRev;
            }
            if (!resourceRev) {
                res.setHeader('etag', '0');
                res.sendStatus(204);
                return;
            }
            if (req.headers['If-None-Match'] === resourceRev) {
                res.sendStatus(304);
                return;
            }

            let content: string;
            if (resourceRev === fromTheiaRev) {
                let version = 1;
                let value = '';
                if (resourceKey === SyncResource.Extensions) {
                    value = await this.theiaPluginService.getCodeSyncResource(req.user.id);
                    version = 5;
                } else if (resourceKey === SyncResource.Settings) {
                    const settings = await this.userStorageResourcesDB.get(req.user.id, userSettingsUri);
                    value = JSON.stringify(<ISettingsSyncContent>{ settings });
                    version = 2;
                }
                content = JSON.stringify(<ISyncData>{ version, content: value });
            } else {
                const contentType = req.headers['content-type'] || '*/*';
                const request = new DownloadUrlRequest();
                request.setOwnerId(req.user.id);
                request.setName(toObjectName(resourceKey, resourceRev));
                request.setContentType(contentType);
                try {
                    const blobsClient = this.blobsProvider.getDefault();
                    const urlResponse = await util.promisify<DownloadUrlRequest, DownloadUrlResponse>(blobsClient.downloadUrl.bind(blobsClient))(request);
                    const response = await fetch(urlResponse.getUrl(), {
                        timeout: 10000,
                        headers: {
                            'content-type': contentType
                        }
                    });
                    if (response.status !== 200) {
                        throw new Error(`code sync: blob service: download failed with ${response.status} ${response.statusText}`);
                    }
                    content = await response.text();
                } catch (e) {
                    if (e.code === status.NOT_FOUND) {
                        res.sendStatus(204);
                        return;
                    }
                    throw e;
                }
            }
            res.setHeader('etag', resourceRev);
            res.type('text/plain');
            res.send(content);
        });
        router.post('/v1/resource/:resource', bodyParser.text({
            limit: config?.contentLimit || defaultContentLimit
        }), async (req, res) => {
            if (!User.is(req.user)) {
                res.sendStatus(204);
                return;
            }
            const resourceKey = ALL_SERVER_RESOURCES.find(key => key === req.params.resource);
            if (!resourceKey) {
                res.sendStatus(204);
                return;
            }
            let latestRev = typeof req.headers['If-Match'] === 'string' ? req.headers['If-Match'] : undefined;
            if (latestRev === fromTheiaRev) {
                latestRev = undefined;
            }
            const revLimit = resourceKey === 'machines' ? 1 : config.resources?.[resourceKey]?.revLimit || config?.revLimit || defautltRevLimit;
            const userId = req.user.id;
            let oldObject: string | undefined;
            const contentType = req.headers['content-type'] || '*/*';
            const rev = await this.db.insert(userId, resourceKey, async (rev, oldRev) => {
                const request = new UploadUrlRequest();
                request.setOwnerId(userId);
                request.setName(toObjectName(resourceKey, rev));
                request.setContentType(contentType);
                const blobsClient = this.blobsProvider.getDefault();
                const urlResponse = await util.promisify<UploadUrlRequest, UploadUrlResponse>(blobsClient.uploadUrl.bind(blobsClient))(request);
                const url = urlResponse.getUrl();
                const content = req.body as string;
                const response = await fetch(url, {
                    timeout: 10000,
                    method: 'PUT',
                    body: content,
                    headers: {
                        'content-length': req.headers['content-length'] || String(content.length),
                        'content-type': contentType
                    }
                });
                if (response.status !== 200) {
                    throw new Error(`code sync: blob service: upload failed with ${response.status} ${response.statusText}`);
                }
                oldObject = oldRev && toObjectName(resourceKey, oldRev);
            }, { latestRev, revLimit });
            if (oldObject) {
                const request = new DeleteRequest();
                request.setOwnerId(userId);
                request.setExact(oldObject);

                const blobsClient = this.blobsProvider.getDefault();
                blobsClient.delete(request, (err: ServiceError | null) => {
                    if (err) {
                        if (err.code === status.NOT_FOUND) {
                            // we're good here
                            return;
                        }
                        log.error({ userId }, 'code sync: failed to delete', err, { object: oldObject });
                    }
                });
            }
            if (!rev) {
                res.sendStatus(412);
                return;
            }
            res.setHeader('etag', rev);
            res.sendStatus(200);
            return;
        });
        router.delete('/v1/resource', async (req, res) => {
            if (!User.is(req.user)) {
                res.sendStatus(204);
                return;
            }
            const userId = req.user.id;
            await this.db.delete(userId, async () => {
                const request = new DeleteRequest();
                request.setOwnerId(userId);
                request.setPrefix(objectPrefix);
                try {
                    const blobsClient = this.blobsProvider.getDefault();
                    await util.promisify(blobsClient.delete.bind(blobsClient))(request);
                } catch (e) {
                    log.error({ userId }, 'code sync: failed to delete', e);
                }
            });
            res.sendStatus(200);

            return;
        });
        return router;
    }

}