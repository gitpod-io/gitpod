/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from '@gitpod/gitpod-protocol/lib/protocol';
import * as express from 'express';
import { injectable } from 'inversify';

// should be aligned with https://github.com/gitpod-io/vscode/blob/75c71b49cc25554adc408e63b876b76dcc984bc1/src/vs/platform/userDataSync/common/userDataSync.ts#L113-L156
export interface IUserData {
    ref: string;
    content: string | null;
}

export const enum SyncResource {
    Settings = 'settings',
    Keybindings = 'keybindings',
    Snippets = 'snippets',
    Extensions = 'extensions',
    GlobalState = 'globalState'
}
export const ALL_SYNC_RESOURCES: SyncResource[] = [SyncResource.Settings, SyncResource.Keybindings, SyncResource.Snippets, SyncResource.Extensions, SyncResource.GlobalState];

export interface IUserDataManifest {
    latest?: Record<ServerResource, string>
    session: string;
}

export type ServerResource = SyncResource | 'machines';
const ALL_SERVER_RESOURCES: ServerResource[] = [...ALL_SYNC_RESOURCES, 'machines'];

interface UserData extends IUserData {
    created: number
}
@injectable()
export class CodeSyncService {

    private readonly data = new Map<string, Map<ServerResource, UserData[]>>();

    get apiRouter(): express.Router {
        const router = express.Router();
        router.get('/v1/manifest', (req, res, next) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                res.sendStatus(401);
                return;
            }
            const session = req.user.id;
            const data = this.data.get(session);
            if (!data) {
                res.sendStatus(204);
                return;
            }
            const latest: Record<ServerResource, string> = Object.create({});
            const manifest: IUserDataManifest = { session, latest };

            data.forEach((value, key) => latest[key] = value[value.length - 1].ref);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(manifest));
        });
        router.get('/v1/resource/:resource', (req, res, next) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                res.sendStatus(401);
                return;
            }
            const session = req.user.id;
            const resource = req.params.resource;
            const resourceKey = ALL_SERVER_RESOURCES.find(key => key === resource);
            const resourceData = resourceKey && this.data.get(session)?.get(resourceKey);
            if (!resourceData) {
                res.sendStatus(204);
                return;
            }
            const result: { url: string, created: number }[] = resourceData.map(e => ({
                url: req.originalUrl + '/' + e.ref,
                created: e.created
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(result));
        });
        router.get('/v1/resource/:resource/:ref', (req, res, next) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                res.sendStatus(401);
                return;
            }
            const session = req.user.id;
            const resource = req.params.resource;
            const resourceKey = ALL_SERVER_RESOURCES.find(key => key === resource);
            if (!resourceKey) {
                res.sendStatus(204);
                return;
            }

            const entries = this.data.get(session)?.get(resourceKey);
            let resourceData: UserData | undefined;
            const ref = req.params.ref;
            if (ref === 'latest') {
                resourceData = entries?.[entries?.length - 1];
            } else {
                resourceData = entries?.find(e => e.ref === ref);
            }
            if (!resourceData) {
                res.setHeader('etag', '0');
                res.sendStatus(204);
                return;
            }
            if (req.headers['If-None-Match'] === resourceData.ref) {
                res.sendStatus(304);
                return;
            }
            res.writeHead(200, { etag: resourceData.ref });
            return res.end(resourceData.content || '');
            return;
        });
        router.post('/v1/resource/:resource', (req, res, next) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                res.sendStatus(401);
                return;
            }
            const session = req.user.id;
            const resource = req.params.resource;
            const resourceKey = ALL_SERVER_RESOURCES.find(key => key === resource);
            if (!resourceKey) {
                res.sendStatus(204);
                return;
            }
            let data = this.data.get(session);
            const entries = data?.get(resourceKey) || [];
            const resourceData = entries[entries.length - 1];
            if (req.headers['If-Match'] !== undefined && req.headers['If-Match'] !== (resourceData ? resourceData.ref : '0')) {
                res.sendStatus(412);
                return;
            }
            const content = req.body as string
            const ref = `${parseInt(resourceData?.ref || '0') + 1}`;
            entries.push({ ref, content, created: Date.now() / 1000 });
            if (!data) {
                data = new Map<ServerResource, UserData[]>();
                this.data.set(session, data);
            }
            data.set(resourceKey, entries);
            res.writeHead(200, { etag: ref });
            return res.end('Ok.');
        });
        router.delete('/v1/resource', (req, res, next) => {
            if (!req.isAuthenticated() || !User.is(req.user)) {
                res.sendStatus(401);
                return;
            }
            const session = req.user.id;
            this.data.delete(session);
            res.sendStatus(200);
            return;
        });
        return router;
    }

}