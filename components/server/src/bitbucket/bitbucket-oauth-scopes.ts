/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// https://confluence.atlassian.com/bitbucket/oauth-on-bitbucket-cloud-238027431.html

export namespace BitbucketOAuthScopes {
  /** Read user info like name, e-mail adresses etc. */
  export const ACCOUNT_READ = 'account';
  /** Access repo info, clone repo over https, read and write issues */
  export const REPOSITORY_READ = 'repository';
  /** Push over https, fork repo */
  export const REPOSITORY_WRITE = 'repository:write';
  /** Lists and read pull requests */
  export const PULL_REQUEST_READ = 'pullrequest';
  /** Create, comment and merge pull requests */
  export const PULL_REQUEST_WRITE = 'pullrequest:write';
  /** Create, list web hooks */
  export const WEBHOOK = 'webhook';

  export const ALL = [ACCOUNT_READ, REPOSITORY_READ, REPOSITORY_WRITE, PULL_REQUEST_READ, PULL_REQUEST_WRITE, WEBHOOK];

  export const Requirements = {
    /**
     * Minimal required permission.
     */
    DEFAULT: ALL,
  };
}
