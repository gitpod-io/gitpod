/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { IStatusServiceClient, StatusServiceClient } from "@gitpod/supervisor-api-grpc/lib/status_grpc_pb";
import { IControlServiceClient, ControlServiceClient } from "@gitpod/supervisor-api-grpc/lib/control_grpc_pb";
import { ITerminalServiceClient, TerminalServiceClient } from "@gitpod/supervisor-api-grpc/lib/terminal_grpc_pb";
import * as grpc from "@grpc/grpc-js";

@injectable()
export class SupervisorClientProvider {
    protected statusClient: IStatusServiceClient | undefined;
    protected controlClient: IControlServiceClient | undefined;
    private terminalClient: TerminalServiceClient | undefined;

    public async getStatusClient(): Promise<IStatusServiceClient> {
        if (!this.statusClient) {
            this.statusClient = new StatusServiceClient(process.env.SUPERVISOR_ADDR || "localhost:22999", grpc.credentials.createInsecure());
        }

        return this.statusClient;
    }

    public async getControlClient(): Promise<IControlServiceClient> {
        if (!this.controlClient) {
            this.controlClient = new ControlServiceClient(process.env.SUPERVISOR_ADDR || "localhost:22999", grpc.credentials.createInsecure());
        }

        return this.controlClient;
    }

    getTerminalClient(): ITerminalServiceClient {
        if (!this.terminalClient) {
            this.terminalClient = new TerminalServiceClient(process.env.SUPERVISOR_ADDR || "localhost:22999", grpc.credentials.createInsecure());
        }
        return this.terminalClient;
    }

}