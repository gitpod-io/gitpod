import { injectable } from "inversify";
import { IStatusServiceClient, StatusServiceClient } from "@gitpod/supervisor/lib/status_grpc_pb";
import * as grpc from "@grpc/grpc-js";

@injectable()
export class SupervisorClientProvider {
    protected statusClient: IStatusServiceClient | undefined;
    
    public async getStatusClient(): Promise<IStatusServiceClient> {
        if (!this.statusClient) {
            this.statusClient = new StatusServiceClient("localhost:22999", grpc.credentials.createInsecure());
        }
        
        return this.statusClient;
    }

}