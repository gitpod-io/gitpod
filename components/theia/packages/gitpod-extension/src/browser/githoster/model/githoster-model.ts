/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Emitter, Event } from "@theia/core/lib/common/event";
import { injectable } from "inversify";
import { PullRequest } from "../../github";

@injectable()
export abstract class GitHosterModel {

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

    protected readonly onDidRefreshChangedEmitter = new Emitter<void>();
    readonly onDidRefreshChanged: Event<void> = this.onDidRefreshChangedEmitter.event;

    abstract pullRequest: PullRequest | undefined

    abstract hasWritePermission(owner: string, repo: string): Promise<boolean>;
}

export namespace GitHosterModel {
    export const FACTORY_TYPE = Symbol("Factory<GitHosterModel>");
}
