import { Disposable, DisposableCollection, GitpodClient, GitpodService, WorkspaceInfo, WorkspaceInstance } from "@gitpod/gitpod-protocol";

export class WorkspaceModel implements Disposable, Partial<GitpodClient> {

    protected workspaces = new Map<string,WorkspaceInfo>();
    protected currentlyFetching = new Set<string>();
    protected disposables = new DisposableCollection();
    
    constructor(protected service: GitpodService, protected setWorkspaces: (ws: WorkspaceInfo[]) => void) {
        service.server.getWorkspaces({
            limit: 50
        }).then( infos => {
            this.updateMap(infos);
            this.notifyWorkpaces();
        });
        this.disposables.push(service.registerClient(this));
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
                    const info = await this.service.server.getWorkspace(instance.workspaceId);
                    this.workspaces.set(instance.workspaceId, info);
                    this.notifyWorkpaces();
                } finally {
                    this.currentlyFetching.delete(instance.workspaceId);
                }
            }
        }
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

    protected notifyWorkpaces(): void {
        let infos = Array.from(this.workspaces.values());
        infos = infos.sort((a,b) => a.latestInstance?.creationTime.localeCompare(b.latestInstance?.creationTime || '') || 1);
        this.setWorkspaces(infos.filter(ws => this.isActive(ws) === this.active) || []);
    }
    
    protected isActive(info: WorkspaceInfo): boolean {
        return info.workspace.pinned || 
            info.latestInstance?.status?.phase !== 'stopped';
    }
}