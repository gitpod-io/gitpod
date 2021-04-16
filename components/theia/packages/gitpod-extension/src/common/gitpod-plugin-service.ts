/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CancellationToken } from '@theia/core/lib/common/cancellation';
import { ResolvedPlugins, ResolvedPluginKind, ResolvePluginsParams, InstallPluginsParams, UninstallPluginParams } from "@gitpod/gitpod-protocol";
import { PluginModel } from '@theia/plugin-ext/lib/common/plugin-protocol';

export const gitpodPluginPath = '/services/gitpodPlugin';

export const GitpodPluginService = Symbol('GitpodPluginService');
export interface GitpodPluginService {

    getUploadUri(): Promise<string>;

    deploy(): Promise<void>;

    find(params: FindExtensionsParams, token: CancellationToken): Promise<FindExtensionsResult>;

    install(params: InstallPluginsParams, token: CancellationToken): Promise<void>;

    uninstall(params: UninstallPluginParams, token: CancellationToken): Promise<void>;

    upload(params: UploadExtensionParams): Promise<string>;

}

export interface DeployedPlugin {
    pluginId: string
    kind: ResolvedPluginKind
}

export interface DidDeployPluginsResult {
    [id: string]: DeployedPlugin
}

export interface GitpodPluginClientEventEmitter {
    onWillDeploy(): void;
    onDidDeploy(event: DidDeployPluginsResult): void;
}

export interface GitpodPluginClient extends GitpodPluginClientEventEmitter {
    resolve(params: ResolvePluginsParams): Promise<ResolvedPlugins>;
}

export interface FindExtensionsParams {
    fileUris: string[];
}

export interface FindExtensionsResult {
    [fileUri: string]: { fullPluginName: string }[];
}

export interface UploadExtensionParams {
    fullPluginName: string;
    targetUrl: string;
}

export interface GitpodPluginModel extends PluginModel {
    author?: string | { name: string };
    icon?: string;
}
