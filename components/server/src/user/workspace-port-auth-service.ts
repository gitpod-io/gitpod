/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceDB } from "@gitpod/gitpod-db/lib/workspace-db";
import { UserDB } from "@gitpod/gitpod-db/lib/user-db";
import { User } from "@gitpod/gitpod-protocol";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { DescribeWorkspaceRequest, PortVisibility } from "@gitpod/ws-manager/lib";
import { worspacePortAuthCookieName as workspacePortAuthCookieName } from "@gitpod/gitpod-protocol/lib/util/workspace-port-authentication";
import { GarbageCollectedCache } from "@gitpod/gitpod-protocol/lib/util/garbage-collected-cache";
import { parseWorkspaceIdFromHostname } from "@gitpod/gitpod-protocol/lib/util/parse-workspace-id";

import { Env } from "../env";
import { TokenService } from "./token-service";

@injectable()
export class WorkspacePortAuthorizationService {
    @inject(Env) protected readonly env: Env;
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(WorkspaceManagerClientProvider) protected readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider;

    protected readonly accessDecisionCache: GarbageCollectedCache<boolean> = new GarbageCollectedCache(5, 10);

    async authorizeWorkspacePortAccess(port: any, hostname: string, authenticatedUser: User | undefined, portAuthHeader: string | undefined): Promise<boolean> {
        const workspacePort = this.parseWorkspacePortFromParameter(port);
        const workspaceId = parseWorkspaceIdFromHostname(hostname);
        if (!workspaceId || !workspacePort) {
            return false;
        }

        let portAuthCookieValue = undefined;
        if (portAuthHeader) {
            const portAuthCookieName = workspacePortAuthCookieName(this.env.hostUrl.toStringWoRootSlash(), workspaceId);
            const cookieValue = this.cookieValue(portAuthHeader.split(';'), portAuthCookieName);
            if (cookieValue && typeof cookieValue === 'string') {
                portAuthCookieValue = cookieValue;
            }
        }

        // up until now everything is sync, now we start with the async + DB + ws-manager turnarounds: cache the response for 5s
        let cacheKey = `${workspaceId}/${workspacePort}`;
        if (portAuthCookieValue) {
            // We have two kind of requests:
            //  - for public ports / shared workspace: come without cookie
            //  - private ports with cookie
            // Both should be cached, but we also have to be as specific as possible to avoid unauthorized users share the
            // authorization with an authorized users (on private ports)
            cacheKey = `${workspaceId}/${workspacePort}/${portAuthCookieValue}`;
        }
        const cachedDecision = this.accessDecisionCache.get(cacheKey);
        if (cachedDecision) {
            return cachedDecision;
        }

        const [hasValidCookieForWorkspace, wsAndPortConfig] = await Promise.all([
            this.checkPortAuthHeader(workspaceId, portAuthCookieValue),
            this.checkWorkspaceAndPortVisibility(workspaceId, workspacePort, authenticatedUser && authenticatedUser.id)
        ]);

        const decision = this.decide(this.env.portAccessForUsersOnly, hasValidCookieForWorkspace, !!authenticatedUser, wsAndPortConfig);
        this.accessDecisionCache.set(cacheKey, decision);

        return decision;
    }

    protected decide(portAccessForUsersOnly: boolean, hasValidCookieForWorkspace: boolean, userAuthenticated: boolean, wsAndPortConfig: WsAndPortConfig): boolean {
        let access = false;
        if (portAccessForUsersOnly) {
            // Originally implemented for DWave
            if (hasValidCookieForWorkspace) {
                // This matches owner and users shared with - even up to 20 minutes after unsharing, due to cookie validity
                if (!wsAndPortConfig.isWsShared) {
                    // WS not shared: Only owner may access
                    if (wsAndPortConfig.isUserWsOwner) {
                        access = true;
                    }
                } else {
                    // Workspace is shared: owner and all users may access
                    access = true;
                }
            } else if (wsAndPortConfig.isPortPublic || wsAndPortConfig.isWsShared) {
                if (userAuthenticated) {
                    access = true;
                }
            }
        } else {
            // The default case for gitpod.io
            if (hasValidCookieForWorkspace || wsAndPortConfig.isPortPublic || wsAndPortConfig.isWsShared) {
                access = true;
            }
        }

        return access;
    }

    protected async checkPortAuthHeader(workspaceId: string, portAuthCookieValue: string | undefined): Promise<boolean> {
        if (!portAuthCookieValue) {
            return false;
        }

        const maybeTokenEntry = await this.userDb.findTokenEntryById(portAuthCookieValue);
        if (!maybeTokenEntry) {
            return false;
        }

        const expectedTokenValue = TokenService.generateWorkspacePortAuthScope(workspaceId);
        if (maybeTokenEntry.token.scopes.some(s => s === expectedTokenValue)) {
            // This is true for everyone who has had a frontend open during the last 30mins (owner, people shared with)
            return true;
        }

        return false;
    }

    protected async checkWorkspaceAndPortVisibility(workspaceId: string, workspacePort: number, userId: string | undefined): Promise<WsAndPortConfig> {
        // Is the workspace port public?
        const authData = await this.workspaceDB.findWorkspacePortsAuthDataById(workspaceId);
        if (!authData) {
            return {};
        }
        const isUserWsOwner = userId ? authData.workspace.ownerId === userId : undefined;

        // In case the workspace is shared: go for it!
        const isWsShared = authData.workspace.shareable;

        // The workspace is not shared: Now we need to look for the specific port: Is it public?
        const visibility = await this.getWorkspacePortVisibility(authData.instance.id, authData.instance.region, workspacePort);
        const isPortPublic = visibility === PortVisibility.PORT_VISIBILITY_PUBLIC;

        // Whe workspace is not shared, port not public
        return { isPortPublic, isWsShared, isUserWsOwner };
    }

    protected parseWorkspacePortFromParameter(maybePort: any): number | undefined {
        if (!maybePort) {
            return undefined;
        }
        try {
            const workspacePort = Number.parseInt(maybePort);
            if (workspacePort < 0) {
                return undefined;
            }
            return workspacePort;
        } catch (err) {
            return undefined;
        }
    }

    protected async getWorkspacePortVisibility(instanceId: string, region: string, workspacePort: number): Promise<PortVisibility | undefined> {
        try {
            const describeRequest = new DescribeWorkspaceRequest();
            describeRequest.setId(instanceId);

            const client = await this.workspaceManagerClientProvider.get(region);
            const describeWorkspaceResponse = await client.describeWorkspace({}, describeRequest);
            const portSpecs = describeWorkspaceResponse.getStatus()!.getSpec()!.getExposedPortsList();

            const portSpec = portSpecs.find((p) => p.getPort() === workspacePort);
            if (!portSpec) {
                return undefined;
            }
            return portSpec.getVisibility();
        } catch (err) {
            log.debug({ instanceId }, "Error while determening port visibility", err, { region, workspacePort });
            return undefined;
        }
    }

    protected cookieValue(cookies: string[], cookieName: string): string | undefined {
        for (const c of cookies) {
            const [k, v] = c.split("=");
            const key = k.trim();
            if (key === cookieName && !!v) {
                return v.trim();
            }
        }
        return undefined;
    }
}

interface WsAndPortConfig {
    isPortPublic?: boolean;
    isWsShared?: boolean;
    isUserWsOwner?: boolean;
}