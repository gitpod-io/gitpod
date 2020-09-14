/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from "inversify";
import { ServedPortsService, ServedPort, ServedPortsChangeEvent } from "../../common/served-ports-service";
import { GitpodInfoService } from "../../common/gitpod-info";
import { GitpodServiceProvider } from "../gitpod-service-provider";
import { PortConfig, PortOnOpen, PortRangeConfig, WorkspaceInstance, GitpodService, Queue, PortVisibility, WorkspaceInstancePort } from "@gitpod/gitpod-protocol";
import { Emitter, Event } from "@theia/core";
import { Deferred } from "@theia/core/lib/common/promise-util";
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";

import debounce = require('lodash.debounce');
import { GitpodPortsAuthManger } from "./gitpod-ports-auth-manager";
import { FileService } from "@theia/filesystem/lib/browser/file-service";
import URI from "@theia/core/lib/common/uri";
import { FileOperationError, FileOperationResult } from "@theia/filesystem/lib/common/files";

export interface PortChange<T> {
    ports: T[]
    didOpen: T[]
    didClose: T[]
}
export interface PortChangeEvent {
    exposed?: PortChange<PortConfig>
    served?: PortChange<ServedPort>
}

export interface PortRange {
    start: number
    end: number
    onOpen?: PortOnOpen
}
export namespace PortRange {
    export function parse(config: PortRangeConfig): PortRange | undefined {
        try {
            const bounds = config.port.split(/[-:]/).map((p: string) => parseInt(p, 10));
            if (bounds.length === 2 && !bounds.some((p: number) => isNaN(p)) && bounds[0] < bounds[1]) {
                return {
                    start: bounds[0],
                    end: bounds[1],
                    onOpen: config.onOpen,
                };
            }
        } catch (error) {
            console.error("Failed to parse port range", { error, config });
        }
    }
}

type PortConfigWithURL = PortConfig & { url?: string };

@injectable()
export class GitpodPortsService {
    protected _servedPorts: ServedPort[] = [];
    protected _instancePorts: PortConfigWithURL[] = [];

    @inject(ServedPortsService) protected servedPortsService: ServedPortsService;
    @inject(GitpodInfoService) protected infoProvider: GitpodInfoService;
    @inject(GitpodServiceProvider) protected serviceProvider: GitpodServiceProvider;
    @inject(FileService) protected fileService: FileService;
    @inject(GitpodFileParser) protected gitpodConfigParser: GitpodFileParser;
    @inject(GitpodPortsAuthManger) protected readonly portsAuthManager: GitpodPortsAuthManger;

    protected workspaceId: string;
    protected service: GitpodService;
    protected configUri: string;

    protected deferredReady = new Deferred<boolean>();
    readonly ready = this.deferredReady.promise;

    @postConstruct()
    protected async init() {
        const info = await this.infoProvider.getInfo();
        this.workspaceId = info.workspaceId;
        this.configUri = 'file://' + info.repoRoot + '/.gitpod.yml';

        // listen on FS change events asap
        this.fileService.onDidFilesChange(async change => {
            if (change.changes.some(c => c.resource.toString().endsWith('/.gitpod.yml'))) {
                this.debouncedUpdateLocalPortConfig();
            }
        });

        // handle instance updates asap
        this.service = await this.serviceProvider.getService();
        let receivedInstanceUpdate = false;
        this.service.registerClient({
            onInstanceUpdate: (instance: WorkspaceInstance) => {
                if (this.workspaceId == instance.workspaceId) {
                    receivedInstanceUpdate = true;
                    this.updateInstancePortConfig(instance.status.exposedPorts || []);
                }
            }
        });

        // handle served ports asap
        let receivedServedPortsEvent = false;
        this.servedPortsService.onServedPortsChangeEvent(e => {
            receivedServedPortsEvent = true;
            this.updateServedPorts(e)
        });

        this.portsAuthManager.start();

        /**
         * initialize
         */

        await Promise.all([
            this.loadWorkspaceConfigPorts(this.workspaceId),
            this.updateLocalPortConfig(),
            this.servedPortsService.getServedPorts().then(servedPorts => {
                // if the response arrives before the event add `didOpen` ports
                this.updateServedPorts({ ports: servedPorts, didOpen: receivedServedPortsEvent ? [] : servedPorts, didClose: [] });
            }),
            this.service.server.getOpenPorts({workspaceId: this.workspaceId}).then(openPorts => {
                if (!receivedInstanceUpdate) {
                    this.updateInstancePortConfig(openPorts);
                }
            }).catch(e => console.error(e))
        ])

        this.deferredReady.resolve();
    }

    public getPortURL(port: number): string | undefined {
        const prt = this._instancePorts.find(p => p.port === port);
        if (!prt) {
            return;
        }
        return prt.url;
    }

    protected async updateServedPorts(served: ServedPortsChangeEvent) {
        this._servedPorts = served.ports;
        if (served.didOpen.length > 0 || served.didClose.length > 0) {
            this.onPortsChangedEmitter.fire({ served });
        }
    }

    protected updateInstancePortConfig(update: WorkspaceInstancePort[]) {
        const prev = this._instancePorts.slice();

        const next = update.map(p => {
            const localOrWorkspaceConfig = this.findLocalOrWorkspaceConfig(p.port);

            return <PortConfigWithURL>{
                port: p.port,
                visibility: p.visibility,
                onOpen: localOrWorkspaceConfig ? localOrWorkspaceConfig.onOpen : undefined,   
                url: p.url
            };
        })

        const didOpen = next.filter(pa => !prev.some(pb => pa.port == pb.port));
        const didClose = prev.filter(pa => !next.some(pb => pa.port == pb.port));
        const didChangeVisibility = next.filter(pa => !prev.some(pb => pa.port === pb.port && pa.visibility === pb.visibility));

        this._instancePorts = next;
        if (didOpen.length > 0 || didClose.length > 0 || didChangeVisibility.length > 0) {
            this.onPortsChangedEmitter.fire({
                exposed: { ports: next, didOpen: [...didOpen, ...didChangeVisibility], didClose }
            });
        }
    }

    protected findLocalOrWorkspaceConfig(port: number): PortConfigWithURL | undefined {
        for (const source of [this.localPortConfig, this.workspaceConfigPorts]) {
            const portConfig = source.filter(config => !PortRangeConfig.is(config)).find(c => c.port === port);
            if (portConfig) {
                return portConfig;
            }
        }
    }

    protected workspaceConfigPorts: PortConfig[] = [];
    protected async loadWorkspaceConfigPorts(workspaceId: string) {
        const workspaceInfo = await this.service.server.getWorkspace({workspaceId});
        const config = workspaceInfo.workspace.config;
        this.workspaceConfigPorts = config.ports ? config.ports : [];
    }

    protected localPortConfig: PortConfig[] = [];
    protected readonly debouncedUpdateLocalPortConfig = debounce(() => this.updateLocalPortConfig(), 100);
    protected async updateLocalPortConfig() {
        let parsedPortConfig: PortConfig[] = [];
        try {
            const contents = await this.fileService.read(new URI(this.configUri));
            const parseResult = this.gitpodConfigParser.parse(contents.value, { acceptPortRanges: true });
            parsedPortConfig = parseResult.config.ports || [];
        } catch (error) {
            if (!(error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND)) {
                console.log(error);
            }
        } finally {
            this.localPortConfig = parsedPortConfig;
            this.tryToOpenInstancePorts();
        }
    }
    protected tryToOpenInstancePorts() {
        const toBeExposed: PortConfig[] = [];
        const next = this._instancePorts.slice();
        for (const source of [this.localPortConfig, this.workspaceConfigPorts]) {
            const exposedInLocalOrWorkspaceConfig = source.filter(config => !PortRangeConfig.is(config));
            for (const config of exposedInLocalOrWorkspaceConfig) {
                const instancePort = next.find(p => p.port === config.port);
                if (!instancePort) {
                    toBeExposed.push(config);
                }
            }
        }
        this.enqueueOpenInstancePorts(toBeExposed);
    }
    protected exposePortsQueue = new Queue();
    protected exposedPortsSet = new Set<number>();
    protected enqueueOpenInstancePorts(toBeExposed: PortConfig[]) {
        for (const config of toBeExposed) {
            if (this.exposedPortsSet.has(config.port)) {
                continue; // avoid multiple calls
            }
            this.exposedPortsSet.add(config.port);
            this.exposePortsQueue.enqueue(() => this.openPort(config));
        }
    }

    protected readonly onPortsChangedEmitter = new Emitter<PortChangeEvent>();
    readonly onPortsChanged: Event<PortChangeEvent> = this.onPortsChangedEmitter.event;

    get servedPorts(): Promise<ServedPort[]> {
        return this.ready.then(() => this._servedPorts.slice());
    }

    get instancePorts(): Promise<PortConfig[]> {
        return this.ready.then(() => this._instancePorts.slice());
    }

    public async findPortConfig(port: number): Promise<{ config: PortConfig | undefined, isPersisted: boolean | undefined }> {
        const localOrWorkspaceConfig = this.findLocalOrWorkspaceConfig(port);
        if (localOrWorkspaceConfig) {
            return { config: localOrWorkspaceConfig, isPersisted: true };
        }
        const instancePorts = await this.instancePorts;
        const instancePortConfig = instancePorts.find(c => c.port === port);
        return { config: instancePortConfig, isPersisted: !!instancePortConfig ? false : undefined };
    }

    public findPortRange(port: number): PortRange | undefined {
        for (const source of [this.localPortConfig, this.workspaceConfigPorts]) {
            for (const config of source) {
                if (PortRangeConfig.is(config)) {
                    const range = PortRange.parse(config);
                    if (range) {
                        if (range.start <= port && port <= range.end) {
                            return range;
                        }
                    } else {
                        console.error('Please fix this port range in your .gitpod.yml:', config);
                    }
                }
            }
        }
    }

    public async openPort(port: ServedPort | PortConfig, visibility?: PortVisibility) {
        let cfg: WorkspaceInstancePort;
        if (PortConfig.is(port)) {
            cfg = port;
            cfg.visibility = visibility || cfg.visibility;
        } else {
            cfg = {
                port: port.portNumber,
                targetPort: port.internalPort,
                visibility: visibility
            };
        }

        const portOpenedInK8s = new Promise(resolve => {
            const { dispose } = this.onPortsChanged(e => {
                if (e.exposed && e.exposed.didOpen.find(i => i.port == cfg.port)) {
                    dispose();
                    resolve();
                }
            });
        });
        await this.service.server.openPort({workspaceId: this.workspaceId, port: cfg});

        await portOpenedInK8s;
    }

}