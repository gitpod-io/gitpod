/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as grpc from "grpc";
import { injectable, inject } from 'inversify';
import { WorkspaceManagerClient } from './core_grpc_pb';
import { PromisifiedWorkspaceManagerClient, linearBackoffStrategy } from "./promisified-client";
import { Disposable } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

export const WorkspaceManagerClientProviderConfig = Symbol("WorkspaceManagerClientProviderConfig");
export interface WorkspaceManagerClientProviderConfig {
    // validates this configuration. If the configuration isn't valid, this method is expected
    // to throw an exception.
    validate(): void;

    defaultManager: string;
    getAddress(name: string): string | undefined;
    isLegacy(name: string): boolean | undefined;
    getAvailableManager(): string[];
}

@injectable()
export class WorkspaceManagerClientProvider implements Disposable {
    @inject(WorkspaceManagerClientProviderConfig)
    protected readonly config: WorkspaceManagerClientProviderConfig;

    // gRPC connections maintain their connectivity themselves, i.e. they reconnect when neccesary.
    // They can also be used concurrently, even across services.
    // Thus it makes sense to cache them rather than create a new connection for each request.
    protected readonly connectionCache = new Map<string, WorkspaceManagerClient>();

    public async getDefault(): Promise<PromisifiedWorkspaceManagerClient> {
        return this.get(this.config.defaultManager);
    }

    public async get(name: string): Promise<PromisifiedWorkspaceManagerClient> {
        const addr = this.config.getAddress(name);
        if (!addr) {
            throw new Error(`Unknown workspace manager \"${name}\"`);
        }

        // The following should probably be removed as soon as we do not need to talk to legacy WorkspaceManagers anymore.
        const legacy = !!this.config.isLegacy(name);
        const options = legacy ? { interceptors: [this.legacyInterceptor()] } : {};

        let client = this.connectionCache.get(name);
        if (!client) {
            client = new WorkspaceManagerClient(addr, grpc.credentials.createInsecure(), options);
            this.connectionCache.set(name, client);
        } else if(client.getChannel().getConnectivityState(true) != grpc.connectivityState.READY) {
            client.close();

            console.warn(`Lost connection to workspace manager \"${name}\" - attempting to reestablish`);
            client = new WorkspaceManagerClient(addr, grpc.credentials.createInsecure(), options);
            this.connectionCache.set(name, client);
        }
        return new PromisifiedWorkspaceManagerClient(client, linearBackoffStrategy(30, 1000));
    }

    public dispose() {
        Array.from(this.connectionCache.values()).map(c => c.close());
    }

    /**
     * The gRPC call namespace for WorkspaceManager has been changed from `protocol` to `wsman`.
     * To be able to talk to older WorkspaceManagers one can set the flag `legacy = true` to the wsman config.
     * 
     * This method returns an interceptor that replaces the namespace from `wsman` to `protocol`.
     * 
     * This method should probably be removed as soon as we do not need to talk to legacy WorkspaceManagers anymore.
     */
    private legacyInterceptor() {
        const interceptor = (options: any, nextCall: Function) => {
            log.debug("LegacyInterceptor: changing gRPC namespace of WorkspaceManager from 'wsman' to 'protocol'")
            const path = options.method_definition.path as string;
            options.method_definition.path = path.replace("wsman.WorkspaceManager", "protocol.WorkspaceManager");
            return new grpc.InterceptingCall(nextCall(options));
        }
        return interceptor;
    }
}

interface ManagerClientEnvConfig {
    name: string,
    address: string,
};

@injectable()
export class WorkspaceManagerClientProviderEnvConfig implements WorkspaceManagerClientProviderConfig {
    protected _managers : ManagerClientEnvConfig[] | undefined = undefined;

    public validate() {
        const localManagerConfig = this.managers.find(m => m.name === this.defaultManager);
        if (!localManagerConfig || !localManagerConfig.address || this.managers.length === 0 ) {
            throw new Error("invalid wsmanager client config");
        }
    }

    public get defaultManager() {
        const result = process.env.WSMAN_CFG_DEFAULT;
        if (!result) {
             throw Error("No WSMAN_CFG_DEFAULT envvar set, but using WorkspaceManagerClientProviderEnvConfig")
        }
        return result;
    }

    public getAddress(name: string): string | undefined {
        const result = this.managers.find(m => m.name === name);
        return result ? result.address : undefined;
    }

    /**
     * The gRPC call namespace for WorkspaceManager has been changed from `protocol` to `wsman`.
     * To be able to talk to older WorkspaceManagers one can set the flag `legacy = true` to the wsman config.
     * 
     * This method returns `true` iff `legacy` is configured to be `true`.
     * 
     * This method should probably be removed as soon as we do not need to talk to legacy WorkspaceManagers anymore.
     * 
     * @param name Name of the WorkspaceManager
     */
    public isLegacy(name: string): boolean | undefined {
        const result = this.managers.find(m => m.name === name);
        return (result && 'legacy' in result) ? result['legacy'] as boolean : undefined;
    }

    public getAvailableManager(): string[] {
        return this.managers.map(c => c.name);
    }

    protected get managers(): ManagerClientEnvConfig[] {
        if (this._managers === undefined) {
            this._managers = this.loadConfigFromEnv();
        }
        return this._managers;
    }

    protected loadConfigFromEnv(): ManagerClientEnvConfig[] {
        const configEncoded = process.env.WSMAN_CFG_MANAGERS;
        if (!configEncoded) {
            throw new Error("WSMAN_CFG_MANAGERS not set!");
        }
        const decoded = Buffer.from(configEncoded, 'base64').toString();
        return JSON.parse(decoded) as ManagerClientEnvConfig[];
    }
}