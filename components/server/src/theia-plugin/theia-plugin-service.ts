/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as url from 'url';
import { injectable, inject } from 'inversify';
import { ResolvePluginsParams, ResolvedPlugins, TheiaPlugin, PreparePluginUploadParams, InstallPluginsParams, UninstallPluginParams, ResolvedPluginKind } from '@gitpod/gitpod-protocol';
import { TheiaPluginDB, UserStorageResourcesDB } from "@gitpod/gitpod-db/lib";
import { Config } from '../config';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { StorageClient } from '../storage/storage-client';
import {  } from '@gitpod/gitpod-db/lib';
import fetch from 'node-fetch';

const userPluginsUri = 'user-plugins://';

export interface ResolvedPluginsResult {
    resolved: ResolvedPlugins
    external: string[]
}

@injectable()
export class TheiaPluginService {

    @inject(Config) protected readonly config: Config;
    @inject(StorageClient) protected readonly storageClient: StorageClient;
    @inject(TheiaPluginDB) protected readonly pluginDB: TheiaPluginDB;
    @inject(UserStorageResourcesDB) protected readonly userStorageResourcesDB: UserStorageResourcesDB;

    /**
     * @returns a sanitized path to the plugin archive which can be used in signed URLs
     */
    protected toObjectPath(pluginEntryId: string, userId: string, fullPluginName: string) {
        return `${userId}.plugin.${pluginEntryId}.${fullPluginName}`.replace(/[^A-Za-z0-9-_.~]/g, '~');
    }

    get bucketName(): string {
        const bucketNameOverride = this.config.theiaPluginsBucketNameOverride;
        if (bucketNameOverride) {
            return bucketNameOverride;
        }

        const hostDenominator = this.config.hostUrl.url.hostname.replace(/\./g, '--');
        return `gitpod-${hostDenominator}-plugins`;
    }

    /**
     * `preflight` will be called by a leading proxy subrequest initiated automatically when the user tries to upload a plugin.
     *
     * @returns a signed URL for the proxy pass
     */
    async preflight(pluginEntryId: string, type: "upload" | "download"): Promise<string> {
        const pluginEntry = await this.pluginDB.findById(pluginEntryId);
        if (!pluginEntry) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Plugin not found.");
        }
        const { bucketName, path, state } = pluginEntry;
        if (state == TheiaPlugin.State.Uploaded && type == "upload") {
            throw new ResponseError(ErrorCodes.CONFLICT, "Plugin already exists.");
        }
        try {
            if (state == TheiaPlugin.State.Uploading) {
                const signedUrl = await this.storageClient.createPluginUploadUrl(bucketName, path);
                return signedUrl;
            } else {
                const signedUrl = await this.storageClient.createPluginDownloadUrl(bucketName, path);
                return signedUrl;
            }
        } catch (error) {
            log.warn(`Failed to create a signed URL for plugin with DB id ${pluginEntryId}!`, error, { bucketName, path, state })
            throw error;
        }
    }

    /**
     * `checkin` will be called by theia backend right after completing the upload successfully.
     *
     * @returns the true `pluginId`
     */
    async checkin(pluginEntryId: string): Promise<string> {
        const pluginEntry = await this.pluginDB.findById(pluginEntryId);
        if (!pluginEntry) {
            throw new ResponseError(ErrorCodes.NOT_FOUND, "Plugin not found.");
        }
        const { state, bucketName, path, pluginId } = pluginEntry;
        if (state == TheiaPlugin.State.Uploaded && pluginId) {
            return pluginId; // nothing to do
        }
        if (state != TheiaPlugin.State.Uploading) {
            throw new ResponseError(ErrorCodes.CONFLICT, "Plugin already processed.");
        }
        let error;
        try {
            const hash = await this.storageClient.getPluginHash(bucketName, path);
            pluginEntry.pluginId = this.toPluginId(pluginEntry.pluginName, hash);
            pluginEntry.hash = hash;
            pluginEntry.state = TheiaPlugin.State.Uploaded;
            await this.pluginDB.storePlugin(pluginEntry);
            return pluginEntry.pluginId;
        } catch (err) {
            log.error("Failed to checkin a plugin.", err, { pluginEntryId });
            error = err;
        }
        try {
            pluginEntry.state = TheiaPlugin.State.CheckinFailed;
            await this.pluginDB.storePlugin(pluginEntry);
        } catch (err) {
            log.error("Failed to mark a failed plugin checkin.", err, { pluginEntryId });
        }
        throw error;
    }

    /**
     * `preparePluginUpload` is called by the frontend via the `GitpodService` in order to prepare the following upload.
     *
     * @returns a public facing URL for the upload which contains the ID of a newly created DB entry for the plugin
     */
    async preparePluginUpload(params: PreparePluginUploadParams, userId: string): Promise<string> {
        const { fullPluginName } = params;
        const pathFn = (pluginEntryId: string) => this.toObjectPath(pluginEntryId, userId, fullPluginName);
        const pluginEntry = await this.pluginDB.newPlugin(userId, fullPluginName, this.bucketName, pathFn);
        const pluginEntryId = pluginEntry.id;
        return this.getPublicPluginURL(pluginEntryId);
    }

    private parseFullPluginName(fullPluginName: string): { name: string, version?: string } {
        const idx = fullPluginName.lastIndexOf('@');
        if (idx === -1) {
            return {
                name: fullPluginName.toLowerCase()
            };
        }
        const name = fullPluginName.substring(0, idx).toLowerCase();
        const version = fullPluginName.substr(idx + 1);
        return { name, version };
    }

    protected toPluginId(fullPluginName: string, hash: string) {
        return `${fullPluginName}:${hash}`;
    }

    protected toFullPluginName(pluginId: string): string {
        return (pluginId.substring(0, pluginId.lastIndexOf(":")) || pluginId).toLowerCase();
    }

    protected getPublicPluginURL(pluginEntryId: string) {
        return this.config.hostUrl
            .with({
                pathname: '/plugins',
                search: `id=${pluginEntryId}`
            }).toString();
    }

    async resolvePlugins(userId: string, { config, builtins, vsxRegistryUrl }: ResolvePluginsParams): Promise<ResolvedPluginsResult> {
        const resolved: ResolvedPlugins = {};
        const external = new Set<string>();
        const addedPlugins = new Set<string>();
        const resolving: Promise<void>[] = [];
        const resolvePlugin = (extension: string, kind: ResolvedPluginKind) => {
            const pluginId = extension.trim();
            const parsed = this.parseFullPluginName(pluginId);
            if (!(addedPlugins.has(parsed.name))) {
                addedPlugins.add(parsed.name);
                if (kind === 'builtin') {
                    resolved[pluginId] = { fullPluginName: this.toFullPluginName(pluginId), url: 'local', kind }
                } else {
                    resolving.push((async () => {
                        try {
                            const resolvedPlugin = await this.resolveFromUploaded(pluginId)
                                || await this.resolveFromOpenVSX(parsed, vsxRegistryUrl);
                            resolved[pluginId] = resolvedPlugin && Object.assign(resolvedPlugin, { kind }) || undefined;
                        } catch (e) {
                            console.error(`Failed to resolve '${pluginId}' plugin:`, e);
                        }
                    })());
                }
            }
        }
        const workspaceExtensions = config && config.vscode && config.vscode.extensions || [];
        for (const extension of workspaceExtensions) {
            try {
                const externalURL = new url.URL(extension);
                external.add(externalURL.toString());
            } catch {
                resolvePlugin(extension, 'workspace');
            }
        }
        const userExtensions = await this.getUserPlugins(userId);
        for (const extension of userExtensions) {
            resolvePlugin(extension, 'user');
        }
        if (builtins) {
            for (const id in builtins) {
                if (builtins[id] && builtins[id]!.kind === 'builtin') {
                    resolvePlugin(id, 'builtin');
                }
            }
        }
        await Promise.all(resolving);
        return { resolved, external: [...external.values()] };
    }

    private async resolveFromUploaded(pluginId: string): Promise<{
        url: string
        fullPluginName: string
    } | undefined> {
        const pluginEntries = await this.pluginDB.findByPluginId(pluginId);
        const uploadedPlugins = pluginEntries.filter(e => e.state == TheiaPlugin.State.Uploaded);
        if (uploadedPlugins.length < 1) {
            log.debug(`No uploaded plugin with id "${pluginId}" found`);
            return undefined;
        }
        if (uploadedPlugins.length > 1) {
            log.debug(`Many plugins with same ID" found. Taking first!`, { count: uploadedPlugins.length, pluginId });
        }
        const pluginEntry = uploadedPlugins[0];
        return {
            fullPluginName: this.toFullPluginName(pluginId),
            url: this.getPublicPluginURL(pluginEntry.id)
        };
    }

    private async resolveFromOpenVSX({ name, version }: { name: string, version?: string }, vsxRegistryUrl = this.config.vsxRegistryUrl): Promise<{
        url: string
        fullPluginName: string
    } | undefined> {
        try {
            const queryUrl = url.parse(vsxRegistryUrl);
            queryUrl.pathname = '/api/-/query';
            const queryHref = url.format(queryUrl)
            const response = await fetch(queryHref, {
                method: 'POST',
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    extensionId: name,
                    extensionVersion: version
                })
            });
            if (response.status !== 200) {
                log.error(`Failed to find extension '${name}@${version || 'latest'}' with '${queryHref}': ${response.status} (${response.statusText}).`);
                return undefined;
            }
            const result: {
                extensions: [{
                    namespace: string
                    name: string
                    version: string
                    files: { download: string }
                } | undefined]
            } = JSON.parse(await response.text())
            const extension = result.extensions[0];
            if (!extension) {
                log.debug(`Extension '${name}@${version || 'latest'}' not found in '${vsxRegistryUrl}' registry.`);
                return undefined;
            }
            return {
                fullPluginName: `${extension.namespace}.${extension.name}@${extension.version}`.toLowerCase(),
                url: extension.files.download,
            };
        } catch (e) {
            log.error(`Failed to find extension '${name}@${version || 'latest'}' in '${vsxRegistryUrl}' registry:`, e);
            return undefined;
        }
    }

    async installUserPlugins(userId: string, params: InstallPluginsParams): Promise<boolean> {
        if (!params.pluginIds.length) {
            return false;
        }
        return await this.updateUserPlugins(userId, pluginIds => {
            let shouldUpdate = false;
            for (const pluginId of params.pluginIds) {
                if (!pluginIds.has(pluginId)) {
                    pluginIds.add(pluginId);
                    shouldUpdate = true;
                }
            }
            return shouldUpdate;
        });
    }

    async uninstallUserPlugin(userId: string, params: UninstallPluginParams): Promise<boolean> {
        return await this.updateUserPlugins(userId, pluginIds =>
            pluginIds.delete(params.pluginId)
        );
    }

    protected async updateUserPlugins(userId: string, doUpdate: (pluginsIds: Set<string>) => boolean): Promise<boolean> {
        const pluginIds = await this.getUserPlugins(userId);
        if (!doUpdate(pluginIds)) {
            return false;
        }
        await this.userStorageResourcesDB.update(userId, userPluginsUri, JSON.stringify([...pluginIds]));
        return true;
    }

    protected async getUserPlugins(userId: string): Promise<Set<string>> {
        const content = await this.userStorageResourcesDB.get(userId, userPluginsUri);
        const json = content && JSON.parse(content);
        return new Set<string>(json);
    }

    async getCodeSyncResource(userId: string): Promise<string> {
        interface ISyncExtension {
            identifier: {
                id: string
            };
            version?: string;
            installed?: boolean;
        }
        const extensions: ISyncExtension[] = []
        const userPlugins = await this.getUserPlugins(userId);
        for (const userPlugin of userPlugins) {
            const fullPluginName = this.toFullPluginName(userPlugin); // drop hash
            const { name, version } = this.parseFullPluginName(fullPluginName);
            extensions.push({
                identifier: { id: name },
                version,
                installed: true
            });
        }
        return JSON.stringify(extensions);
    }

}
