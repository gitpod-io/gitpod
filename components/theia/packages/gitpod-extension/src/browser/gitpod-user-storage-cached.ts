/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from "inversify";
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { GitpodServer } from "@gitpod/gitpod-protocol";
import { Disposable } from "@theia/core";
import { JsonRpcProxy } from "@gitpod/gitpod-protocol/lib/messaging/proxy-factory";

/**
 * To avoid having badly written extensions executing too much requests and putting pressure on other components we
 * cache writes and reads to the GitpodUserStorage.
 */
@injectable()
export class CachedUserStorage implements Disposable {

    static INTERVAL_SECONDS = 10;

    @inject(GitpodServiceProvider) protected serviceProvider: GitpodServiceProvider;

    protected readonly contentCache = new Map<string, string>();
    protected updatedSinceLastWrite = new Set<string>();

    protected timout: NodeJS.Timeout | undefined;


    @postConstruct()
    initialize() {
        this.startPeriodicCacheWriter(CachedUserStorage.INTERVAL_SECONDS);
    }

    async write(resource: GitpodServer.UpdateUserStorageResourceOptions): Promise<void> {
        this.contentCache.set(resource.uri, resource.content);
        this.updatedSinceLastWrite.add(resource.uri);
        
        console.count(`user storage write to: ${resource.uri}`);
    }

    async read(req: GitpodServer.GetUserStorageResourceOptions): Promise<string> {
        const cached = this.contentCache.get(req.uri);
        if (cached !== undefined) {
            return cached;
        }

        const dbContent = await this.getServer().getUserStorageResource(req);
        const cachedContent = this.contentCache.get(req.uri);
        if (cachedContent !== undefined) {
            // Preferring cached content makes the world view of the Workspace (window) more consistent: it guarantees
            // that it sees all writes it has done before).
            // All data from the DB might have been overriden by other workspaces/windows.
            return cachedContent;
        } else {
            this.contentCache.set(req.uri, dbContent);
            return dbContent;
        }
    }

    protected startPeriodicCacheWriter(intervalSeconds: number) {
        const interval = intervalSeconds * 1000;

        const performWrites = async () => {
            const writeStart = Date.now();

            const updatedUris = this.updatedSinceLastWrite;
            this.updatedSinceLastWrite = new Set<string>();

            const server = this.getServer();
            for (const uri of updatedUris) {
                let gotDisconnectedDuringUpdate = false;
                let listener = server.onDidCloseConnection(_ => {
                    gotDisconnectedDuringUpdate = true;
                    listener.dispose();
                });

                try {
                    const content = this.contentCache.get(uri)!;
                    await server.updateUserStorageResource({ uri, content });
                } catch (err) {
                    if (gotDisconnectedDuringUpdate) {
                        this.updatedSinceLastWrite.add(uri);
                    } else {
                        console.error(`failed to update '${uri}' resource`, err);
                    }
                } finally {
                    listener.dispose();
                }
            }

            const waitFor = interval - (Date.now() - writeStart);
            this.timout = setTimeout(performWrites, waitFor > 0 ? waitFor : 0)
        };
        performWrites();
    }

    dispose() {
        if (this.timout) {
            clearTimeout(this.timout);
            this.timout = undefined;
        }
    }

    protected getServer(): JsonRpcProxy<GitpodServer> {
        return this.serviceProvider.getService().server;
    }
}