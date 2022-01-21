/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { RepositoryService } from '../../../src/repohost/repo-service';
import { inject, injectable } from 'inversify';
import { CommitContext, User, WorkspaceContext } from '@gitpod/gitpod-protocol';
import { GitHubGraphQlEndpoint } from '../../../src/github/api';

@injectable()
export class GitHubService extends RepositoryService {
  @inject(GitHubGraphQlEndpoint) protected readonly githubQueryApi: GitHubGraphQlEndpoint;

  async canAccessHeadlessLogs(user: User, context: WorkspaceContext): Promise<boolean> {
    if (!CommitContext.is(context)) {
      return false;
    }

    try {
      // If you have no "viewerPermission" on a repository you may not access it's headless logs
      // Ref: https://docs.github.com/en/graphql/reference/enums#repositorypermission
      const result: any = await this.githubQueryApi.runQuery(
        user,
        `
                query {
                    repository(name: "${context.repository.name}", owner: "${context.repository.owner}") {
                        viewerPermission
                    }
                }
            `,
      );
      return result.data.repository !== null;
    } catch (err) {
      return false;
    }
  }
}
