/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export class Repository {
    readonly fullName: string;
    constructor(
        readonly name: string,
        readonly owner: string,
        readonly pushPermission?: boolean,
    ) {
        this.fullName = this.owner + '/' + this.name;
    }
}

export interface GitHosterRepo {
    parent: GitHosterRepo | undefined,
    id: number,
    source: GitHosterRepo | undefined,
    owner: { login: string },
    name: string,
    default_branch: string
    forks_count: number
}
