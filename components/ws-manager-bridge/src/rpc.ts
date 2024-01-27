/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as grpc from "@grpc/grpc-js";
import { ServiceError as grpcServiceError } from "@grpc/grpc-js";

export class GRPCError extends Error implements Partial<grpcServiceError> {
    public name = "ServiceError";

    details: string;

    constructor(public readonly status: grpc.status, err: any) {
        super(GRPCError.errToMessage(err));

        this.details = this.message;
    }

    static errToMessage(err: any): string | undefined {
        if (typeof err === "string") {
            return err;
        } else if (typeof err === "object") {
            return err.message;
        }
    }

    static isGRPCError(obj: any): obj is GRPCError {
        return obj !== undefined && typeof obj === "object" && "status" in obj;
    }
}
