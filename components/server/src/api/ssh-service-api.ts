/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { SSHService as SSHServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/ssh_connect";
import { inject, injectable } from "inversify";
import { SSHKeyService } from "../user/sshkey-service";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import {
    CreateSSHPublicKeyRequest,
    CreateSSHPublicKeyResponse,
    DeleteSSHPublicKeyRequest,
    DeleteSSHPublicKeyResponse,
    ListSSHPublicKeysRequest,
    ListSSHPublicKeysResponse,
} from "@gitpod/public-api/lib/gitpod/v1/ssh_pb";
import { ctxUserId } from "../util/request-context";
import { validate as uuidValidate } from "uuid";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

@injectable()
export class SSHServiceAPI implements ServiceImpl<typeof SSHServiceInterface> {
    @inject(SSHKeyService)
    private readonly sshKeyService: SSHKeyService;

    @inject(PublicAPIConverter)
    private readonly apiConverter: PublicAPIConverter;

    async listSSHPublicKeys(req: ListSSHPublicKeysRequest, _: HandlerContext): Promise<ListSSHPublicKeysResponse> {
        const response = new ListSSHPublicKeysResponse();
        const sshKeys = await this.sshKeyService.getSSHPublicKeys(ctxUserId(), ctxUserId());
        response.sshKeys = sshKeys.map((i) => this.apiConverter.toSSHPublicKey(i));

        return response;
    }

    async createSSHPublicKey(req: CreateSSHPublicKeyRequest, _: HandlerContext): Promise<CreateSSHPublicKeyResponse> {
        if (!req.name) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "name is required");
        }
        if (!req.key) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "key is required");
        }

        const response = new CreateSSHPublicKeyResponse();

        const result = await this.sshKeyService.addSSHPublicKey(ctxUserId(), ctxUserId(), {
            name: req.name,
            key: req.key,
        });
        response.sshKey = this.apiConverter.toSSHPublicKey(result);

        return response;
    }

    async deleteSSHPublicKey(req: DeleteSSHPublicKeyRequest, _: HandlerContext): Promise<DeleteSSHPublicKeyResponse> {
        if (!uuidValidate(req.sshKeyId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "sshKeyId is required");
        }

        await this.sshKeyService.deleteSSHPublicKey(ctxUserId(), ctxUserId(), req.sshKeyId);

        const response = new DeleteSSHPublicKeyResponse();
        return response;
    }
}
