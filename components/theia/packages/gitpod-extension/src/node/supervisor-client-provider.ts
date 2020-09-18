/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { IStatusServiceClient, StatusServiceClient } from "@gitpod/supervisor/lib/status_grpc_pb";
import * as grpc from "@grpc/grpc-js";

@injectable()
export class SupervisorClientProvider {
    protected statusClient: IStatusServiceClient | undefined;
    
    public async getStatusClient(): Promise<IStatusServiceClient> {
        if (!this.statusClient) {
            this.statusClient = new StatusServiceClient(process.env.SUPERVISOR_ADDR || "localhost:22999", grpc.credentials.createInsecure());
        }
        
        return this.statusClient;
    }

}