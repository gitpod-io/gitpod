/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Bitbucket } from "bitbucket";
import { injectable } from "inversify";
import { CheckWriteAccessResult, IGitTokenValidator, IGitTokenValidatorParams } from "../workspace/git-token-validator";

@injectable()
export class BitbucketTokenValidator implements IGitTokenValidator {

    async checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult> {
        const { token, host, repoFullName } = params;

        const result: CheckWriteAccessResult = {
            found: false,
            isPrivateRepo: undefined,
            writeAccessToRepo: undefined,
            mayWritePrivate: true,
            mayWritePublic: true
        };

        const options = {
            notice: false,
            auth: { token: token },
            baseUrl: `https://api.${host}/2.0`,
        };
        const api = new Bitbucket(options);
        const repos = (await api.user.listPermissionsForRepos({ q: `repository.full_name="${repoFullName}"` })).data.values

        if (repos && repos.length > 0) {
            if (repos.length > 1) {
                console.warn(`checkWriteAccessForBitbucketRepo: Found more than one repo for ${repoFullName}.`);
            }
            result.found = true;
            result.isPrivateRepo = repos[0].repository!.is_private;
            const matchingRepo = repos.find(r => r.permission == "write" || r.permission == "admin");
            if (matchingRepo) {
                result.writeAccessToRepo = true;
            }
        }

        return result;
    }
}

