import { inject, injectable } from "inversify";
import * as grpc from "@grpc/grpc-js";
import { WorkspacesServiceServer } from "./workspaces";
import { WorkspacesServiceService } from "@gitpod/public-api/lib/gitpod/v1/workspaces_grpc_pb";

@injectable()
export class PublicAPIService {
    @inject(WorkspacesServiceServer) protected readonly workspaces: WorkspacesServiceServer;

    public serve(address: string) {
        const server = new grpc.Server();
        server.addService(WorkspacesServiceService, this.workspaces.service());
        server.bind(`127.0.0.1:7423`, grpc.ServerCredentials.createInsecure());
        server.start();
    }

}

export function getCallingUserID(md: grpc.Metadata): string | undefined {
    const res = md.get("calling-user-id");
    if (!res) {
        return;
    }

    return res[0].toString();
}

export interface UnaryCallArgs<Req> {
    callingUserID: string;
    request: Req;
}

export function unaryAsync<Req, Resp>(h: (req: UnaryCallArgs<Req>) => Promise<Resp>): grpc.handleUnaryCall<Req, Resp> {
    return (call: grpc.ServerUnaryCall<Req, Resp>, callback: grpc.sendUnaryData<Resp>): void => {
        h({
            callingUserID: getCallingUserID(call.metadata) || "",
            request: call.request,
        }).then(resp => callback).catch(callback);
    }
}
