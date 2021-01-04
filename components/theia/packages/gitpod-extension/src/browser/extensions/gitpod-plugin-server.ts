/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PluginServer, PluginStorageKind, PluginType } from "@theia/plugin-ext";
import { KeysToAnyValues, KeysToKeysToAnyValue } from "@theia/plugin-ext/lib/common/types";
import { CommitContext } from "@gitpod/gitpod-protocol";
import { GitpodInfoService } from "../../common/gitpod-info";
import { GitpodServiceProvider } from "../gitpod-service-provider";
import { CachedUserStorage } from "../gitpod-user-storage-cached";


export class GitpodPluginServer implements PluginServer {
    constructor(
        protected orig: PluginServer,
        protected serviceProvider: GitpodServiceProvider,
        protected info: GitpodInfoService,
        protected cachedUserStorage: CachedUserStorage) {    
    }

    deploy(pluginEntry: string, type?: PluginType): Promise<void> {
        return this.orig.deploy(pluginEntry, type);
    }

    undeploy(pluginId: string): Promise<void> {
        return this.orig.undeploy(pluginId);
    }

    protected workspaceStorageURI: string;

    protected async getUri(kind: PluginStorageKind): Promise<string> {
        if (kind === undefined) { // globalstoragekind
            return 'global-storage://'
        }
        if (!this.workspaceStorageURI) {
            const info = await this.info.getInfo();
            const service = await this.serviceProvider.getService();
            const ws = await service.server.getWorkspace(info.workspaceId);
            if (CommitContext.is(ws.workspace.context)) {
                this.workspaceStorageURI = 'workspace-storage:/' + encodeURIComponent(ws.workspace.context.repository.cloneUrl) +'/';
            }
        }
        return this.workspaceStorageURI;
    }

    protected localCache = new Map<string, KeysToKeysToAnyValue>(); 

    protected async getStorage(kind: PluginStorageKind): Promise<KeysToKeysToAnyValue> {
        const uri = await this.getUri(kind);
        if (!this.localCache.has(uri)) {
            const storageString = await this.cachedUserStorage.read({ uri });
            let storage: KeysToKeysToAnyValue = {};
            if (storageString.trim().length > 0) {
                try {
                    storage = JSON.parse(storageString);
                } catch (e) {
                    console.error(e);
                }
            }
            this.localCache.set(uri, storage);
        }
        return this.localCache.get(uri)!;
    }

    protected async setStorage(storage: KeysToKeysToAnyValue, kind: PluginStorageKind): Promise<boolean> {
        const uri = await this.getUri(kind);
        this.localCache.set(uri, storage);
        await this.cachedUserStorage.write({ uri, content: JSON.stringify(storage) });
        return true;
    }

    async setStorageValue(key: string, value: KeysToAnyValues, kind: PluginStorageKind): Promise<boolean> {
        const storage = await this.getStorage(kind);
        storage[key] = value;
        return this.setStorage(storage, kind);
    }

    async getStorageValue(key: string, kind: PluginStorageKind): Promise<KeysToAnyValues> {
        const storage = await this.getStorage(kind);
        return storage[key];
    }

    async getAllStorageValues(kind: PluginStorageKind): Promise<KeysToKeysToAnyValue> {
        return this.getStorage(kind);
    }
}