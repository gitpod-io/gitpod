/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitHubEndpoint } from "./github-endpoint";
import { Permissions } from '../github-model/permissions';
import { GitHubRestApi } from "./github-rest-api";

export namespace TEST_TOKENS {
    export const READ_EMAIL_PERMISSION = "<dummy>";
    export const READ_ORG_PERMISSION = "<dummy>";
    export const READ_EMAIL__READ_ORG__WRITE_PUBLIC__PERMISSION = "<dummy>";
    export const READ_EMAIL__READ_ORG__WRITE_PRIVATE__PERMISSION = "<dummy>";
}

export class TestGitHubComEndpoint extends GitHubEndpoint {
    constructor(protected token: string) { super(); }
    async getToken(host: string, permissions?: Permissions): Promise<string> {
        return this.token;
    }
    protected get host(): string {
        return "github.com";
    }
}

export class TestGitHubComRestApi extends GitHubRestApi {
    constructor(protected token: string) { super(); }
    async getToken(host: string, permissions?: Permissions): Promise<string> {
        return this.token;
    }
    protected get host(): string {
        return "github.com";
    }
    protected get enabled(): boolean {
        return true;
    }
    protected get userAgent(): string {
        return "gitpod-test";
    }
}