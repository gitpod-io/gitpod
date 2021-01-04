/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as inspector from 'inspector';
import debounce = require('lodash.debounce');
import * as os from "os";
import * as path from "path";
import * as fs from "fs-extra";
import * as request from "request";
import { v4 as uuidv4 } from 'uuid'
import * as requestretry from "requestretry";
import { FileUri } from "@theia/core/lib/node/file-uri";
import { Disposable } from "@theia/core/lib/common/disposable";
import { injectable, postConstruct, inject } from "inversify";
import { PluginDeployer, PluginDeployerResolver } from "@theia/plugin-ext";
import { PluginDeployerImpl } from "@theia/plugin-ext/lib/main/node/plugin-deployer-impl";
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";
import {
    GitpodPluginService, FindExtensionsParams,
    FindExtensionsResult, UploadExtensionParams, GitpodPluginClient,
    GitpodPluginClientEventEmitter, DidDeployPluginsResult
} from '../../common/gitpod-plugin-service';
import { GitpodPluginDeployerHandler } from "./gitpod-plugin-deployer-handler";
import { GitpodPluginModel } from './gitpod-plugin-model';
import { GitpodPluginResolver } from './gitpod-plugin-resolver';
import { CancellationToken } from '@theia/core/lib/common/cancellation';
import { WorkspaceConfig, ResolvedPlugins, ResolvedPlugin, InstallPluginsParams, UninstallPluginParams } from '@gitpod/gitpod-protocol';
import filenamify = require('filenamify');
import { ApplicationPackage } from '@theia/application-package/lib/application-package';
import { PluginIndexEntry } from '@gitpod/gitpod-protocol/lib/theia-plugins';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';

@injectable()
export class GitpodPluginDeployer implements GitpodPluginService {

    protected readonly gitpodFilePath: string | undefined;

    protected readonly downloadPath: string;
    protected readonly uploadRawPath: string;
    protected readonly extensionsFiles = new Map<string, string>();
    protected readonly builtinIndex = new Map<string, string>();
    /**
     * Static plugins can be contributed via the docker image at the build time.
     * Such docker image should configure `GITPOD_STATIC_PLUGINS` env variable pointing to a folder containing vsix files.
     */
    protected readonly staticPlugins = new Map<string, ResolvedPlugin & { pluginId: string }>()

    @inject(GitpodFileParser)
    protected readonly parser: GitpodFileParser;

    @inject(PluginDeployer)
    protected readonly deployer: PluginDeployerImpl;

    @inject(GitpodPluginDeployerHandler)
    protected readonly deployed: GitpodPluginDeployerHandler;

    @inject(GitpodPluginResolver)
    protected readonly resolver: GitpodPluginResolver;

    @inject(ApplicationPackage)
    protected readonly pkg: ApplicationPackage;

    @inject(VSXEnvironment)
    private readonly vsxEnvironment: VSXEnvironment;

    constructor() {
        this.downloadPath = path.resolve(os.tmpdir(), 'download-vscode-extensions');
        fs.ensureDirSync(this.downloadPath);
        fs.emptyDirSync(this.downloadPath);


        this.uploadRawPath = path.resolve(os.tmpdir(), 'upload-raw-vscode-extensions');
        fs.ensureDirSync(this.uploadRawPath);
        fs.emptyDirSync(this.uploadRawPath);

        const rootPath = process.env.GITPOD_REPO_ROOT;
        if (rootPath) {
            this.gitpodFilePath = path.join(rootPath, '.gitpod.yml');
        }
    }

    @postConstruct()
    protected async init(): Promise<void> {
        // disable default resolvers
        this.deployer['pluginResolvers'] = this.deployer['pluginResolvers'].filter((resolver: PluginDeployerResolver) => resolver instanceof GitpodPluginResolver);

        await Promise.all([
            this.initBuiltInPlugins(),
            this.initStaticPlugins()
        ]);
        // a guard against a premature deploy by a new client (see `addClient` method)
        this.readyToDeploy = true;

        this.deploy();
        if (this.gitpodFilePath) {
            fs.watchFile(this.gitpodFilePath, () => this.deploy());
        }
    }

    /* init extensionsFiles with local package index */
    protected async initBuiltInPlugins(): Promise<void> {
        const builtinPluginBase = process.env.GITPOD_BUILT_IN_PLUGINS || path.resolve(this.pkg.projectPath, "plugins");
        try {
            const pluginIndex: PluginIndexEntry[] =
                JSON.parse((await fs.readFile(path.join(builtinPluginBase, "plugins.json"))).toString());

            for (const p of pluginIndex) {
                const loc = path.join(builtinPluginBase, p.loc);
                this.builtinIndex.set(p.name.toLowerCase(), FileUri.create(loc).toString());
                console.log("Registered built-in plugin", { name: p.name, loc });
            }
        } catch (err) {
            console.error("cannot read built-in plugin index", err);
        }
    }

    protected async initStaticPlugins(): Promise<void> {
        if (process.env.GITPOD_STATIC_PLUGINS) {
            try {
                const staticPluginsPath = process.env.GITPOD_STATIC_PLUGINS;
                for (const staticPluginFolder of await fs.readdir(staticPluginsPath)) {
                    const staticPluginUri = FileUri.create(path.join(staticPluginsPath, staticPluginFolder)).toString();
                    try {
                        const result = await this.findExtensions([staticPluginUri]);
                        const found = result[staticPluginUri];
                        if (found) {
                            for (const staticPlugin of found) {
                                const fullPluginName = staticPlugin.fullPluginName;
                                this.staticPlugins.set(fullPluginName, {
                                    fullPluginName,
                                    // dummy unique id to avoid collisions with resolved plugins
                                    pluginId: fullPluginName + '-static.' + uuidv4(),
                                    // a user cannot delete static plugins
                                    kind: 'builtin',
                                    // never used
                                    url: ''
                                })
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to initilaize static plugin from '${staticPluginUri}'`, e);
                    }
                }
            } catch (e) {
                console.error('Failed to initilaize static plugins', e);
            }
        }
    }

    protected readonly clients = new Set<GitpodPluginClient>();
    addClient(client: GitpodPluginClient): Disposable {
        // make sure that a new client gets up to date deployment state
        if (this.lastDeployResult) {
            client.onDidDeploy(this.lastDeployResult);
        }
        // make sure that all new plugins are installed on workspace restart
        // since GITPOD_RESOLVED_EXTENSIONS won't contain them
        this.deploy();
        this.clients.add(client);
        return Disposable.create(() => this.clients.delete(client));
    }

    protected notifyClients(event: 'onWillDeploy'): void;
    protected notifyClients(event: 'onDidDeploy', result: DidDeployPluginsResult): void;
    protected notifyClients(event: keyof GitpodPluginClientEventEmitter, arg?: any): void {
        this.clients.forEach(client => client[event](arg));
    }

    protected readyToDeploy = false;
    protected deployQueue = Promise.resolve();
    protected lastDeployResult: DidDeployPluginsResult | undefined;
    deploy = debounce(() => this.deployQueue = this.deployQueue.then(async () => {
        if (!this.readyToDeploy) {
            return;
        }
        const resolvedPlugins = new Map<string, ResolvedPlugin & { pluginId: string }>();
        const deployed = new Set<string>(this.deployed.getFullPluginNames());
        const toDeploy = new Set<string>();
        const toUndeploy = new Set<string>(deployed);
        try {
            for (const [fullPluginName, staticPlugin] of this.staticPlugins) {
                resolvedPlugins.set(fullPluginName, staticPlugin);
                if (!deployed.has(fullPluginName)) {
                    toDeploy.add(fullPluginName)
                }
            }

            const resolveResult = await this.resolvePlugins();
            if (!resolveResult) {
                return;
            }
            const toInstall: Promise<void>[] = [];
            for (const pluginId in resolveResult) {
                const resolvedPlugin = resolveResult[pluginId];
                if (!resolvedPlugin) {
                    continue;
                }
                const { fullPluginName, url, kind } = resolvedPlugin;
                if (kind === 'builtin' && this.staticPlugins.has(fullPluginName)) {
                    // static built-in plugins take a priority over default built-in plugins
                    continue;
                }
                resolvedPlugins.set(fullPluginName, Object.assign(resolvedPlugin, { pluginId }));
                if (deployed.has(fullPluginName)) {
                    toUndeploy.delete(fullPluginName);
                } else {
                    toDeploy.add(fullPluginName)
                }
                toInstall.push((async () => {
                    try {
                        let fileUri = this.extensionsFiles.get(fullPluginName);
                        if (fileUri) {
                            const fsPath = FileUri.fsPath(fileUri);
                            if (await fs.pathExists(fsPath)) {
                                return;
                            }
                            this.extensionsFiles.delete(fullPluginName);
                        }

                        if (this.builtinIndex.has(fullPluginName)) {
                            fileUri = this.builtinIndex.get(fullPluginName);
                        } else {
                            fileUri = await this.download({ fullPluginName, url });
                        }

                        if (fileUri) {
                            await this.findExtensions([fileUri]);
                        }
                    } catch (e) {
                        console.error(`Failed to install "${fullPluginName}" from "${url}":`, e);
                    }
                })());
            }
            if (toDeploy.size || toUndeploy.size) {
                this.notifyClients('onWillDeploy');
                await Promise.all(toInstall);
                await this.deployer['deployMultipleEntries'](Array.from(resolvedPlugins.keys()));
            }
        } catch (e) {
            console.error('Failed to deploy extensions:', e);
        } finally {
            if (toDeploy.size || toUndeploy.size) {
                this.lastDeployResult = {};
                for (const id of this.deployed.getExtensionKeys()) {
                    const fullPluginName = this.deployed.getExtension(id);
                    const resolved = fullPluginName && resolvedPlugins.get(fullPluginName);
                    if (resolved) {
                        this.lastDeployResult[id] = {
                            pluginId: resolved.pluginId,
                            kind: resolved.kind
                        };
                    }
                }
                this.notifyClients('onDidDeploy', this.lastDeployResult);
            }
        }
    }), 500, { leading: true });

    protected async resolvePlugins(): Promise<ResolvedPlugins | undefined> {
        try {
            const vsxRegistryUri = await this.vsxEnvironment.getRegistryUri();
            const value: GitpodPluginClient = this.clients.values().next().value;
            if (value) {
                const config = await this.parse();
                const resolved = await value.resolve({ config, builtins: this.getBuiltins(), vsxRegistryUrl: vsxRegistryUri.toString() });
                return resolved;
            }
        } catch (e) {
            console.error('Failed to resolve plugins', e);
            // a connection to FE or Gitpod Server were lost
            // a redeploy happens each time whenever a FE or a Gitpod Server reconnects
            // so cancel current deployment 
            return undefined;
        }
        return process.env.GITPOD_RESOLVED_EXTENSIONS ? JSON.parse(process.env.GITPOD_RESOLVED_EXTENSIONS) : {};
    }

    protected getBuiltins(): ResolvedPlugins | undefined {
        if (!process.env.GITPOD_RESOLVED_EXTENSIONS) {
            return undefined;
        }
        const result = JSON.parse(process.env.GITPOD_RESOLVED_EXTENSIONS);
        for (const id in result) {
            if (result[id]!.kind !== 'builtin') {
                delete result[id];
            }
        }
        return result;
    }

    protected async parse(): Promise<WorkspaceConfig | undefined> {
        if (!this.gitpodFilePath) {
            return undefined;
        }
        try {
            const content = await fs.readFile(this.gitpodFilePath, 'utf-8');
            const { config } = this.parser.parse(content);
            return config;
        } catch {
            return undefined;
        }
    }

    protected async download({ fullPluginName, url }: { fullPluginName: string, url: string }): Promise<string | undefined> {
        console.log(`${fullPluginName}: trying to download from "${url}"...`);
        return new Promise<string>((resolve, reject) => {
            const downloadPath = path.join(this.downloadPath, filenamify(fullPluginName));
            requestretry({
                url,
                method: 'GET',
                // if we cannot establish connection in 5s then try again in 2s 5 times
                // if we cannot read then timeout in 5s
                maxAttempts: 5,
                timeout: 5000,
                retryDelay: 2000,
                retryStrategy: requestretry.RetryStrategies.HTTPOrNetworkError
            }, (err, response) => {
                if (err) {
                    reject(err);
                } else if (response && response.statusCode === 404) {
                    resolve(undefined);
                } else if (response && response.statusCode !== 200) {
                    reject(new Error(response.statusMessage));
                }
            }).pipe(fs.createWriteStream(downloadPath))
                .on('error', reject)
                .on('close', () => resolve(FileUri.create(downloadPath).toString()));
        }).then(downloadUri => {
            if (downloadUri) {
                console.log(`${fullPluginName}: downloaded to "${downloadUri}"`);
            } else {
                console.log(`${fullPluginName}: not found`);
            }
            return downloadUri;
        }, e => {
            console.error(`${fullPluginName}: failed to download, reason: `, e);
            return undefined;
        });
    }

    async upload(params: UploadExtensionParams): Promise<string> {
        const { fullPluginName, targetUrl } = params;
        const fileUri = this.extensionsFiles.get(fullPluginName);
        if (!fileUri) {
            throw new Error("Upload failed: file not found");
        }
        const stat = await fs.stat(FileUri.fsPath(fileUri));

        const upload = new Promise<void>((resolve, reject) =>
            fs.createReadStream(FileUri.fsPath(fileUri))
                .pipe(request.put({
                    url: targetUrl,
                    headers: {
                        'Content-Length': stat.size
                    }
                }, (err, response) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (response && response.statusCode !== 200) {
                        if (response.statusCode === 400) {
                            console.error("Bad Request: /plugin returned with code 400.", err);
                        }
                        reject(new Error(response.statusMessage));
                        return;
                    }
                    resolve(undefined);
                }))
                .on('error', reject)
                .on('close', () => resolve(undefined))
        );
        try {
            // first try to upload ...
            await upload;

            // ... then finalize the upload and fetch the true `pluginId`!
            const pluginId = await new Promise<string>((resolve, reject) => {
                request.get(targetUrl + "&checkin=true", (err, response) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (response && response.statusCode !== 200) {
                        reject(new Error(response.statusMessage));
                        return;
                    }
                    resolve(response.body);
                })
            });
            this.extensionsFiles.set(pluginId, fileUri);
            return pluginId;
        } catch (error) {
            console.error("Upload failed: " + (error && error.message), error);
            throw new Error("Upload failed");
        }
    }

    find(params: FindExtensionsParams, token: CancellationToken): Promise<FindExtensionsResult> {
        return this.profile('findExtensions', () => this.findExtensions(params.fileUris, token));
    }

    protected async profile<T>(tag: string, cb: () => Promise<T>): Promise<T> {
        if (!process.env.GITPOD_ENABLE_PROFILE) {
            return cb();
        }
        const session = new inspector.Session();
        session.connect();
        await new Promise((resolve, reject) => session.post('Profiler.enable', err => err ? reject(err) : resolve()));
        try {
            await new Promise((resolve, reject) => session.post('Profiler.start', err => err ? reject(err) : resolve()));
            try {
                return await cb();
            } finally {
                const profile = await new Promise<string>((resolve, reject) => session.post('Profiler.stop', (err, { profile }) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(JSON.stringify(profile));
                    }
                }));
                await fs.writeFile(`/workspace/gitpod/profile-${tag}-${new Date().getMilliseconds()}.cpuprofile`, profile);
            }
        } finally {
            session.disconnect();
        }
    }

    async install({ pluginIds }: InstallPluginsParams, token: CancellationToken): Promise<void> {
        await this.updateGitpodFile(async (gitpodFilePath) => {
            let content = '';
            try {
                content = await fs.readFile(gitpodFilePath, 'utf-8');
            } catch { /* no-op*/ }
            if (token.isCancellationRequested) {
                return;
            }
            const model = new GitpodPluginModel(content);
            if (model.add(...pluginIds)) {
                return String(model);
            }
        }, token);
    }

    async uninstall({ pluginId }: UninstallPluginParams, token: CancellationToken): Promise<void> {
        return this.updateGitpodFile(async (gitpodFilePath) => {
            let content = '';
            try {
                content = await fs.readFile(gitpodFilePath, 'utf-8');
            } catch { /* no-op*/ }
            if (token.isCancellationRequested) {
                return;
            }
            const model = new GitpodPluginModel(content);
            if (model.remove(pluginId)) {
                return String(model);
            }
        }, token);
    }

    protected gitpodFileWriteQueue: Promise<any> = Promise.resolve();
    protected updateGitpodFile(udpate: (gitpodFilePath: string) => Promise<string | undefined>, token: CancellationToken): Promise<void> {
        return this.gitpodFileWriteQueue = this.gitpodFileWriteQueue.then(async () => {
            if (!this.gitpodFilePath) {
                return;
            }
            try {
                const newContent = await udpate(this.gitpodFilePath);
                if (newContent !== undefined && !token.isCancellationRequested) {
                    await fs.ensureFile(this.gitpodFilePath);
                    await fs.writeFile(this.gitpodFilePath, newContent.trim(), 'utf-8');
                }
            } catch (e) {
                console.error('Failed to update gitpod file: ', e);
            }
            // trigger deploy eagerly even if there are not file changes
            // useful to:
            //   - retrigger install/uninstall if previos update failed for some reasons
            //   - report progress of install/uninstall
            await this.deploy();
        });
    }

    protected async findExtensions(fileUris: string[], token?: CancellationToken): Promise<FindExtensionsResult> {
        const result: FindExtensionsResult = {};
        const uniquePlugins = new Set<string>();
        for (const fileUri of new Set(fileUris)) {
            const found = await this.resolver.find(fileUri);
            if (token && token.isCancellationRequested) {
                return {};
            }
            if (found && !uniquePlugins.has(found.fullPluginName)) {
                uniquePlugins.add(found.fullPluginName);
                const extensions = result[fileUri] || [];
                extensions.push(found)
                result[fileUri] = extensions;
                this.extensionsFiles.set(found.fullPluginName, fileUri);
            }
        }
        return result;
    }

    async getUploadUri(): Promise<string> {
        return FileUri.create(this.uploadRawPath).toString();
    }

}