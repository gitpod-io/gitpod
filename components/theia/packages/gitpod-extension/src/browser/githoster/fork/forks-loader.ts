/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CancellationToken } from "@theia/core/lib/common/cancellation";
import { GitHosterRepo, Repository } from "../model/types";

export abstract class ForksLoader {

    abstract computeForkMenuOptions(originRepo: ForksLoader.Repo): Promise<ForksLoader.ForkMenuOptions>;

    abstract getForks(owner: string, repo: string, acceptor: (fork: Repository) => void, token: CancellationToken): Promise<void>;

    abstract getRepository(owner: string, repo: string): Promise<GitHosterRepo | undefined>;
}

export namespace ForksLoader {
    export const FACTORY_TYPE = Symbol("Factory<ForkLoader>");

    export interface Repo {
        name: string;
        owner: string;
    }

    export interface ForkMenuOptions {
        /** my login name (owner namespace) */
        myLogin: string,
        /** list of owner names / namespaces where the user is allowed to create a fork to */
        createForkForOwners: string[],
        /** list of owner names / namespaces where a fork already exists */
        switchToForkOfOwners: string[],
        /** list of missing permissions */
        missingPermissions: {
            scope: string,
            menuLabel: string,
            menuDescription: string,
            menuCompleteMessage: string,
        }[],
    }
}
