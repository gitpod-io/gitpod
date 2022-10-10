/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    Disposable,
    DisposableCollection,
    GitpodClient,
    WorkspaceInfo,
    WorkspaceInstance,
} from "@gitpod/gitpod-protocol";
import { hoursBefore, isDateSmallerOrEqual } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { getGitpodService } from "../service/service";
import { createConnectTransport, createPromiseClient, Interceptor } from "@bufbuild/connect-web";
import { WorkspacesService } from "@gitpod/public-api/lib/gitpod/v1/workspaces_connectweb";

export class WorkspaceModel implements Disposable, Partial<GitpodClient> {
    protected workspaces = new Map<string, WorkspaceInfo>();
    protected currentlyFetching = new Set<string>();
    protected disposables = new DisposableCollection();
    protected internalLimit = 50;
    public initialized = false;

    get limit(): number {
        return this.internalLimit;
    }

    set limit(limit: number) {
        this.internalLimit = limit;
        this.internalRefetch();
    }

    constructor(
        protected setActiveWorkspaces: (ws: WorkspaceInfo[]) => void,
        protected setInActiveWorkspaces: (ws: WorkspaceInfo[]) => void,
    ) {
        this.internalRefetch();
    }

    protected async internalRefetch(): Promise<void> {
        this.disposables.dispose();
        this.disposables = new DisposableCollection();
        const [infos, pinned] = await Promise.all([
            getGitpodService().server.getWorkspaces({
                limit: this.internalLimit,
                includeWithoutProject: true,
            }),
            getGitpodService().server.getWorkspaces({
                limit: this.internalLimit,
                pinnedOnly: true,
                includeWithoutProject: true,
            }),
        ]);

        const token = await getGitpodService().server.generateNewGitpodToken({
            type: 1,
            scopes: [
                "function:getGitpodTokenScopes",
                "function:getWorkspace",
                "function:getWorkspaces",
                "function:listenForWorkspaceInstanceUpdates",
                "resource:default",
            ],
        });

        const authInterceptor: Interceptor = (next) => async (req) => {
            req.header.set("Authorization", `Bearer ${token}`);
            return await next(req);
        };

        const transport = createConnectTransport({
            baseUrl: window.location.origin + "/public",
            interceptors: [authInterceptor],
        });
        const client = createPromiseClient(WorkspacesService, transport);

        const resp = await client.listWorkspaces({});
        console.log(resp);

        this.updateMap(infos);
        // Additional fetch pinned workspaces
        // see also: https://github.com/gitpod-io/gitpod/issues/4488
        this.updateMap(pinned);
        this.notifyWorkpaces();
        this.disposables.push(getGitpodService().registerClient(this));
    }

    protected updateMap(workspaces: WorkspaceInfo[]) {
        for (const ws of workspaces) {
            this.workspaces.set(ws.workspace.id, ws);
        }
    }

    dispose(): void {
        this.disposables.dispose();
    }

    async onInstanceUpdate(instance: WorkspaceInstance) {
        if (this.workspaces) {
            if (this.workspaces.has(instance.workspaceId)) {
                const info = this.workspaces.get(instance.workspaceId)!;
                info.latestInstance = instance;
                if (info.workspace !== undefined) {
                    this.notifyWorkpaces();
                }
            } else if (!this.currentlyFetching.has(instance.workspaceId)) {
                try {
                    this.currentlyFetching.add(instance.workspaceId);
                    const info = await getGitpodService().server.getWorkspace(instance.workspaceId);
                    if (info.workspace.type === "regular") {
                        this.workspaces.set(instance.workspaceId, info);
                        this.notifyWorkpaces();
                    }
                } finally {
                    this.currentlyFetching.delete(instance.workspaceId);
                }
            }
        }
    }

    async deleteWorkspace(id: string): Promise<void> {
        await getGitpodService().server.deleteWorkspace(id);
        this.workspaces.delete(id);
        this.notifyWorkpaces();
    }

    searchTerm: string | undefined;
    setSearch(searchTerm: string) {
        if (searchTerm !== this.searchTerm) {
            this.searchTerm = searchTerm;
            this.notifyWorkpaces();
        }
    }

    async togglePinned(workspaceId: string) {
        const ws = this.workspaces.get(workspaceId)?.workspace;
        if (ws) {
            ws.pinned = !ws.pinned;
            await getGitpodService().server.updateWorkspaceUserPin(ws.id, "toggle");
            this.notifyWorkpaces();
        }
    }

    async toggleShared(workspaceId: string) {
        const ws = this.workspaces.get(workspaceId)?.workspace;
        if (ws) {
            ws.shareable = !ws.shareable;
            await getGitpodService().server.controlAdmission(ws.id, ws.shareable ? "everyone" : "owner");
            this.notifyWorkpaces();
        }
    }

    protected notifyWorkpaces(): void {
        this.initialized = true;
        let infos = Array.from(this.workspaces.values());
        if (this.searchTerm) {
            infos = infos.filter(
                (ws) =>
                    (ws.workspace.description + ws.workspace.id + ws.workspace.contextURL + ws.workspace.context)
                        .toLowerCase()
                        .indexOf(this.searchTerm!.toLowerCase()) !== -1,
            );
        }
        const now = new Date().toISOString();
        function activeDate(info: WorkspaceInfo): string {
            if (!info.latestInstance) {
                return info.workspace.creationTime;
            }
            if (info.latestInstance.status.phase === "stopped" || info.latestInstance.status.phase === "unknown") {
                return WorkspaceInfo.lastActiveISODate(info);
            }
            return info.latestInstance.stoppedTime || info.latestInstance.stoppingTime || now;
        }
        infos = infos.sort((a, b) => {
            const result = activeDate(b).localeCompare(activeDate(a));
            if (result === 0) {
                // both active now? order by creationtime
                return WorkspaceInfo.lastActiveISODate(b).localeCompare(WorkspaceInfo.lastActiveISODate(a));
            }
            return result;
        });
        const activeInfo = infos.filter((ws) => this.isActive(ws));
        const inActiveInfo = infos.filter((ws) => !this.isActive(ws));
        this.setActiveWorkspaces(activeInfo);
        this.setInActiveWorkspaces(inActiveInfo.slice(0, this.internalLimit - activeInfo.length));
    }

    protected isActive(info: WorkspaceInfo): boolean {
        const lastSessionStart = WorkspaceInfo.lastActiveISODate(info);
        const twentyfourHoursAgo = hoursBefore(new Date().toISOString(), 24);
        return (
            (info.workspace.pinned ||
                (!!info.latestInstance && info.latestInstance.status?.phase !== "stopped") ||
                isDateSmallerOrEqual(twentyfourHoursAgo, lastSessionStart)) &&
            !info.workspace.softDeleted
        );
    }

    public getAllFetchedWorkspaces(): Map<string, WorkspaceInfo> {
        return this.workspaces;
    }
}
