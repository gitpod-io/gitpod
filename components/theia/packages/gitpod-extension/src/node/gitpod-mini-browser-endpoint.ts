/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

const vhost = require('vhost');
import express = require('express');
import { MaybePromise } from '@theia/core/lib/common/types';
import { FileUri } from '@theia/core/lib/node/file-uri';
import { MiniBrowserEndpoint } from '@theia/mini-browser/lib/node/mini-browser-endpoint';
import { Application, Request } from 'express';
import { injectable } from 'inversify';
import { MiniBrowserEndpoint as MiniBrowserEndpointNS } from '../common/mini-browser-endpoint';

@injectable()
export class GitpodMiniBrowserEndpoint extends MiniBrowserEndpoint {

    private attachRequestHandlerPromise: Promise<void>;

    configure(app: Application): void {
        this.attachRequestHandlerPromise = this.attachRequestHandler(app);
    }

    async onStart(): Promise<void> {
        await Promise.all(Array.from(this.getContributions(), async handler => {
            const extensions = await handler.supportedExtensions();
            for (const extension of (Array.isArray(extensions) ? extensions : [extensions]).map(e => e.toLocaleLowerCase())) {
                const existingHandler = this.handlers.get(extension);
                if (!existingHandler || handler.priority > existingHandler.priority) {
                    this.handlers.set(extension, handler);
                }
            }
        }));
        await this.attachRequestHandlerPromise;
    }

    async supportedFileExtensions(): Promise<Readonly<{ extension: string, priority: number }>[]> {
        return Array.from(this.handlers.entries(), ([extension, handler]) => ({ extension, priority: handler.priority() }));
    }

    protected async attachRequestHandler(app: Application): Promise<void> {
        const miniBrowserApp = express();
        miniBrowserApp.get('*', async (request, response) => this.response(await this.getUri(request), response));
        app.use(vhost(await this.getVirtualHostRegExp(), miniBrowserApp));
    }

    protected getUri(request: Request): MaybePromise<string> {
        return FileUri.create(request.path).toString(true);
    }

    protected async getVirtualHostRegExp(): Promise<RegExp> {
        const pattern = process.env[MiniBrowserEndpointNS.HOST_PATTERN_ENV] ?? MiniBrowserEndpointNS.HOST_PATTERN_DEFAULT;
        const vhostRe = pattern
            .replace('.', '\\.')
            .replace('{{uuid}}', '.+')
            .replace('{{hostname}}', '.+');
        return new RegExp(vhostRe, 'i');
    }
}
