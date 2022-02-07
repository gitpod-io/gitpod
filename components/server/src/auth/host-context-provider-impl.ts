/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { HostContext } from "./host-context";
import { interfaces, injectable, inject } from "inversify";
import { AuthProviderParams } from "./auth-provider";
import { Config } from "../config";
import { AuthProviderService } from "./auth-provider-service";
import { HostContextProvider, HostContextProviderFactory } from "./host-context-provider";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { HostContainerMapping } from "./host-container-mapping";
import { RepositoryService } from "../repohost/repo-service";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { repeat } from "@gitpod/gitpod-protocol/lib/util/repeat";

@injectable()
export class HostContextProviderImpl implements HostContextProvider {
    protected fixedHosts = new Map<string, HostContext>();
    protected dynamicHosts = new Map<string, HostContext>();

    @inject(Config)
    protected readonly config: Config;

    @inject(AuthProviderService)
    protected authProviderService: AuthProviderService;

    @inject(HostContextProviderFactory)
    protected factory: HostContextProviderFactory;

    async init() {
        await this.ensureInitialized();
    }

    protected initialized = false;
    protected async ensureInitialized() {
        if (this.initialized) {
            return;
        }
        this.createFixedHosts();

        try {
            await this.updateDynamicHosts({ });
        } catch (error) {
            log.error(`Failed to update dynamic hosts.`, error);
        }

        // schedule periodic update of dynamic hosts
        repeat(async () => {
            const span = TraceContext.startSpan("updateDynamicHosts");
            try {
                await this.updateDynamicHosts({span});
            } catch (error) {
                log.error(`Failed to update dynamic hosts.`, error);
            } finally {
                span.finish();
            }
        }, 1999);
        this.initialized = true;
    }

    protected createFixedHosts() {
        const apConfigs = this.config.authProviderConfigs;
        for (const apConfig of apConfigs) {
            const container = this.factory.createHostContext(apConfig);
            if (container) {
                this.fixedHosts.set(apConfig.host, container);
            }
        }
    }

    protected async updateDynamicHosts(ctx: TraceContext) {
        const knownOAuthRevisions = Array.from(this.dynamicHosts.entries())
            .map(([_, hostContext]) => hostContext.authProvider.params.oauthRevision)
            .filter(rev => !!rev) as string[];
        const newAndUpdatedAuthProviders = await this.authProviderService.getAllAuthProviders(knownOAuthRevisions);
        ctx.span?.setTag("updateDynamicHosts.newAndUpdatedAuthProviders", newAndUpdatedAuthProviders.length);

        for (const config of newAndUpdatedAuthProviders) {
            const { host } = config;

            const existingContext = this.dynamicHosts.get(host);
            const existingConfig = existingContext && existingContext.authProvider.params;
            if (existingConfig && config.id === existingConfig.id) {
                if (existingConfig.host !== config.host) {
                    log.warn("Ignoring host update for dynamic Auth Provider: " + host, { config, existingConfig });
                    continue;
                }
                if (existingConfig.status === config.status) {
                    if (!!config.oauthRevision && existingConfig.oauthRevision === config.oauthRevision) {
                        continue;
                    }
                    if (JSON.stringify(existingConfig.oauth) === JSON.stringify(config.oauth)) {
                        continue;
                    }
                }
                log.debug("Updating existing dynamic Auth Provider: " + host, { config, existingConfig });
            } else {
                log.debug("Creating new dynamic Auth Provider: " + host, { config });
            }


            const container = this.factory.createHostContext(config);
            if (container) {
                this.dynamicHosts.set(host, container);
            } else {
                log.warn("Did not update dynamic Auth Provider " + host, { config });
            }
        }

        // remove obsolete entries
        const currentHosts = new Set(await this.authProviderService.getAllAuthProviderHosts())
        ctx.span?.setTag("updateDynamicHosts.currentHostProviders", currentHosts.size);
        const tobeRemoved = [...this.dynamicHosts.keys()].filter(h => !currentHosts.has(h));
        for (const host of tobeRemoved) {
            const hostContext = this.dynamicHosts.get(host);
            log.debug("Disposing dynamic Auth Provider: " + host, { host, hostContext });

            this.dynamicHosts.delete(host);
        }
    }

    getAll(): HostContext[] {
        this.ensureInitialized();
        const fixed = Array.from(this.fixedHosts.values());
        const dynamic = Array.from(this.dynamicHosts.values());
        return [...fixed, ...dynamic];
    }

    get(hostname: string): HostContext | undefined {
        this.ensureInitialized();
        hostname = hostname.toLowerCase();
        const hostContext = this.fixedHosts.get(hostname) || this.dynamicHosts.get(hostname);
        if (!hostContext) {
            log.debug("No HostContext for " + hostname);
        }
        return hostContext;
    }

    findByAuthProviderId(authProviderId: string): HostContext | undefined {
        return this.getAll().find(h => h.authProvider.authProviderId === authProviderId);
    }

    static createHostContext(parentContainer: interfaces.Container, authProviderConfig: AuthProviderParams): HostContext | undefined {
        const container = parentContainer.createChild();
        container.bind(AuthProviderParams).toConstantValue(authProviderConfig);
        container.bind(HostContext).toSelf().inSingletonScope();
        container.bind(RepositoryService).toSelf().inSingletonScope();

        const hostContainerMapping = parentContainer.get(HostContainerMapping);
        const containerModules = hostContainerMapping.get(authProviderConfig.type);
        if (!containerModules) {
            return undefined;
        }

        containerModules.forEach(m => container.load(m));
        return container.get<HostContext>(HostContext);
    }
}
