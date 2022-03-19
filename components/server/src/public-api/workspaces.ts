import { inject, injectable } from "inversify";
import { IWorkspacesServiceServer } from "@gitpod/public-api/lib/gitpod/v1/workspaces_grpc_pb";
import * as gitpod_v1_workspaces_pb from "@gitpod/public-api/lib/gitpod/v1/workspaces_pb";
import * as grpc from "@grpc/grpc-js";
import { UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { unaryAsync, UnaryCallArgs } from "./service";

@injectable()
export class WorkspacesServiceServer {
    @inject(UserDB)
    protected readonly userDB: UserDB;

    @inject(WorkspaceDB)
    protected readonly workspaceDB: WorkspaceDB;

    public service(): IWorkspacesServiceServer {
        return {
            listWorkspaces:                 unaryAsync(this.listWorkspaces),
            getWorkspace:                   unaryAsync(this.getWorkspace),
            createAndStartWorkspace:        unaryAsync(this.createAndStartWorkspace),
            startWorkspace:                 unaryAsync(this.startWorkspace),
            getActiveWorkspaceInstance:     unaryAsync(this.getActiveWorkspaceInstance),
            getWorkspaceInstanceOwnerToken: unaryAsync(this.getWorkspaceInstanceOwnerToken),
            listenToWorkspaceInstance:      this.listenToWorkspaceInstance,
            listenToImageBuildLogs:         this.listenToImageBuildLogs,
            stopWorkspace:                  this.stopWorkspace,
        }
    }

    protected async listWorkspaces(req: UnaryCallArgs<gitpod_v1_workspaces_pb.ListWorkspacesRequest>): Promise<gitpod_v1_workspaces_pb.ListWorkspacesResponse> {
        const nfo = await this.workspaceDB.find({
            userId: req.callingUserID,
            includeHeadless: false,
            includeWithoutProject: true,
            limit: req.request.getPagination()?.getPageSize() || 100,
        })

        const resp = new gitpod_v1_workspaces_pb.ListWorkspacesResponse();
        resp.setResultList(nfo.map(ws => {
            const r = new gitpod_v1_workspaces_pb.ListWorkspacesResponse.WorkspaceAndInstance();

            const rws = new gitpod_v1_workspaces_pb.Workspace();
            rws.setDescription(ws.workspace.description);
            rws.setOwnerId(ws.workspace.ownerId);
            rws.setProjectId(ws.workspace.projectId || "");
            rws.setWorkspaceId(ws.workspace.id);

            const ctx = new gitpod_v1_workspaces_pb.WorkspaceContext();
            rws.setContext(ctx);

            r.setResult(rws);

            if (!!ws.latestInstance) {
                const instance = new gitpod_v1_workspaces_pb.WorkspaceInstance();
                instance.setInstanceId(ws.latestInstance.id);

                const status = new gitpod_v1_workspaces_pb.WorkspaceInstanceStatus();
                switch(ws.latestInstance.status.phase) {
                    case "initializing":
                        status.setPhase(gitpod_v1_workspaces_pb.WorkspaceInstanceStatus.Phase.PHASE_INITIALIZING);
                        break;
                    case "pending":
                        status.setPhase(gitpod_v1_workspaces_pb.WorkspaceInstanceStatus.Phase.PHASE_PENDING);
                        break;
                    case "preparing":
                        // status.setPhase(gitpod_v1_workspaces_pb.WorkspaceInstanceStatus.Phase.PHASE_);
                        // TODO(cw): need to figure out what to do here
                        break;
                    case "running":
                        status.setPhase(gitpod_v1_workspaces_pb.WorkspaceInstanceStatus.Phase.PHASE_RUNNING);
                        break;
                    case "stopping":
                        status.setPhase(gitpod_v1_workspaces_pb.WorkspaceInstanceStatus.Phase.PHASE_STOPPING);
                        break;
                    case "stopped":
                        status.setPhase(gitpod_v1_workspaces_pb.WorkspaceInstanceStatus.Phase.PHASE_STOPPED);
                        break;
                }
                if (ws.workspace.shareable) {
                    status.setAdmission(gitpod_v1_workspaces_pb.AdmissionLevel.ADMISSION_LEVEL_EVERYONE);
                } else {
                    status.setAdmission(gitpod_v1_workspaces_pb.AdmissionLevel.ADMISSION_LEVEL_OWNER_ONLY);
                }
                instance.setWorkspaceId(ws.latestInstance.workspaceId);
                instance.setStatus(status);
                r.setLastActiveInstances(instance);
            }

            return r;
        }))
        return resp;
    }

    protected async getWorkspace(req: UnaryCallArgs<gitpod_v1_workspaces_pb.GetWorkspaceRequest>): Promise<gitpod_v1_workspaces_pb.GetWorkspaceResponse> {
        const resp = new gitpod_v1_workspaces_pb.GetWorkspaceResponse();
        return resp;
    }

    protected async createAndStartWorkspace(req: UnaryCallArgs<gitpod_v1_workspaces_pb.CreateAndStartWorkspaceRequest>): Promise<gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse> {
        const resp = new gitpod_v1_workspaces_pb.CreateAndStartWorkspaceResponse();
        return resp;
    }

    protected async startWorkspace(req: UnaryCallArgs<gitpod_v1_workspaces_pb.StartWorkspaceRequest>): Promise<gitpod_v1_workspaces_pb.StartWorkspaceResponse> {
        const resp = new gitpod_v1_workspaces_pb.StartWorkspaceResponse();
        return resp;
    }

    protected async getActiveWorkspaceInstance(req: UnaryCallArgs<gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceRequest>): Promise<gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse> {
        const resp = new gitpod_v1_workspaces_pb.GetActiveWorkspaceInstanceResponse();
        return resp;
    }

    protected async getWorkspaceInstanceOwnerToken(req: UnaryCallArgs<gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenRequest>): Promise<gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse> {
        const resp = new gitpod_v1_workspaces_pb.GetWorkspaceInstanceOwnerTokenResponse();
        return resp;
    }

    listenToWorkspaceInstance: grpc.handleServerStreamingCall<gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceRequest, gitpod_v1_workspaces_pb.ListenToWorkspaceInstanceResponse>;
    listenToImageBuildLogs: grpc.handleServerStreamingCall<gitpod_v1_workspaces_pb.ListenToImageBuildLogsRequest, gitpod_v1_workspaces_pb.ListenToImageBuildLogsResponse>;
    stopWorkspace: grpc.handleServerStreamingCall<gitpod_v1_workspaces_pb.StopWorkspaceRequest, gitpod_v1_workspaces_pb.StopWorkspaceResponse>;

}
