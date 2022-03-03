/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';
import fetch from 'node-fetch';
import { CheckWriteAccessResult, IGitTokenValidator, IGitTokenValidatorParams } from '../workspace/git-token-validator';

@injectable()
export class GitLabTokenValidator implements IGitTokenValidator {
    async checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult> {
        let found = false;
        let isPrivateRepo: boolean | undefined;
        let writeAccessToRepo: boolean | undefined;
        const { token, host, repoFullName } = params;

        try {
            const request = {
                query: `query {project(fullPath: "${repoFullName}") { visibility, userPermissions{ pushCode } } } `,
            };
            const response = await fetch(`https://${host}/api/graphql`, {
                timeout: 5000,
                method: 'POST',
                body: JSON.stringify(request),
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (response.ok) {
                found = true;
                const json = (await response.json()) as any;
                const project = json.data && json.data.project;
                if (project) {
                    isPrivateRepo = project.visibility !== 'public';
                    const pushCode = project.userPermissions && project.userPermissions.pushCode;
                    writeAccessToRepo = pushCode === true;
                }
            } else {
                throw new Error(response.statusText);
            }
        } catch (e) {
            console.error(e);
            throw e;
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
