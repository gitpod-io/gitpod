/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { CheckWriteAccessResult, IGitTokenValidator, IGitTokenValidatorParams } from "../workspace/git-token-validator";
import { AzureDevOpsApi } from "./azure-api";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class AzureDevOpsTokenValidator implements IGitTokenValidator {
    @inject(AzureDevOpsApi) protected readonly azureDevOpsApi: AzureDevOpsApi;

    async checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult> {
        let found = false;
        let isPrivateRepo: boolean | undefined;
        let writeAccessToRepo: boolean | undefined = false;
        try {
            await this.azureDevOpsApi.getRepository(params.token, params.owner, params.repo);
            found = true;
            isPrivateRepo = true;
            writeAccessToRepo = true;
        } catch (error) {
            log.error(error);
        }
        return {
            found,
            isPrivateRepo,
            writeAccessToRepo,
            mayWritePrivate: true,
            mayWritePublic: true,
        };
    }
}
