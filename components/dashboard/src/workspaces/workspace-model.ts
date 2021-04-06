/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable, DisposableCollection, GitpodClient, WorkspaceInfo, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../service/service";

export class WorkspaceModel implements Disposable, Partial<GitpodClient> {
    
    protected workspaces = new Map<string,WorkspaceInfo>();
    protected currentlyFetching = new Set<string>();
    protected disposables = new DisposableCollection();
    protected internalLimit = 50;

    get limit(): number {
        return this.internalLimit;
    }
    
    set limit(limit: number) {
        this.internalLimit = limit;
        this.internalRefetch();
    }
    
    constructor(protected setWorkspaces: (ws: WorkspaceInfo[]) => void) {
        this.internalRefetch();
    }
    
    protected internalRefetch() {
        this.disposables.dispose();
        this.disposables = new DisposableCollection();
        getGitpodService().server.getWorkspaces({
            limit: this.internalLimit
        }).then( infos => {
            this.updateMap(infos);
            this.notifyWorkpaces();
        });
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
                    this.workspaces.set(instance.workspaceId, info);
                    this.notifyWorkpaces();
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
    
    protected internalActive = true;
    get active() {
        return this.internalActive;
    }
    set active(active: boolean) {
        if (active !== this.internalActive) {
            this.internalActive = active;
            this.notifyWorkpaces();
        }
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
            await getGitpodService().server.updateWorkspaceUserPin(ws.id, 'toggle');
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
        let infos = Array.from(this.workspaces.values());
        infos = infos.filter(ws => !this.active || this.isActive(ws));
        if (this.searchTerm) {
            infos = infos.filter(ws => (ws.workspace.description+ws.workspace.id+ws.workspace.contextURL+ws.workspace.context).toLowerCase().indexOf(this.searchTerm!.toLowerCase()) !== -1);
        }
        infos = infos.sort((a,b) => {  
           return WorkspaceInfo.lastActiveISODate(b).localeCompare(WorkspaceInfo.lastActiveISODate(a));
        });
        this.setWorkspaces(infos);
    }
    
    protected isActive(info: WorkspaceInfo): boolean {
        return info.workspace.pinned || 
            info.latestInstance?.status?.phase !== 'stopped';
    }

    public getAllFetchedWorkspaces(): Map<string, WorkspaceInfo> {
        return this.workspaces;
    }

}