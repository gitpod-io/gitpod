/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { CheckWriteAccessResult, IGitTokenValidator, IGitTokenValidatorParams } from "../workspace/git-token-validator";
import { AzureDevOpsApi } from "./azure-api";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { getOrgAndProject } from "./azure-converter";

@injectable()
export class AzureDevOpsTokenValidator implements IGitTokenValidator {
    @inject(AzureDevOpsApi) protected readonly azureDevOpsApi: AzureDevOpsApi;

    async checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult> {
        let found = false;
        let isPrivateRepo: boolean | undefined;
        let writeAccessToRepo: boolean | undefined = false;
        try {
            const [azOrg, azProject] = getOrgAndProject(params.owner);
            await this.azureDevOpsApi.getRepository(params.token, azOrg, azProject, params.repo);
            // once repository is found, we know the token is valid
            found = true;
            // we don't know if the repository is private or public from API
            isPrivateRepo = true;
            // there's no API to check if the token has write access to the repository
            // we required vso.code_write scope, so default should be true
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
