/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable } from 'inversify';
import { WorkspaceConfig, GithubAppConfig } from '@gitpod/gitpod-protocol';
import * as deepmerge from 'deepmerge';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

const defaultConfig: GithubAppConfig = {
    prebuilds: {
        addCheck: true,
        addBadge: false,
        addComment: false,
        addLabel: false,
        branches: false,
        master: true,
        pullRequests: true,
        pullRequestsFromForks: false,
    },
};

@injectable()
export class GithubAppRules {
    protected mergeWithDefaultConfig(cfg: WorkspaceConfig | undefined): GithubAppConfig {
        let result: GithubAppConfig = defaultConfig;

        if (!cfg || !cfg.github) {
            return result;
        }

        return deepmerge(defaultConfig, cfg.github);
    }

    public shouldRunPrebuild(
        config: WorkspaceConfig | undefined,
        isDefaultBranch: boolean,
        isPR: boolean,
        isFork: boolean,
    ): boolean {
        if (!config) {
            return false;
        }

        const hasPrebuildTask = !!config.tasks && config.tasks.find((t) => !!t.before || !!t.init || !!t.prebuild);
        if (!hasPrebuildTask) {
            return false;
        }

        const prebuildCfg = this.mergeWithDefaultConfig(config).prebuilds!;
        if (isPR) {
            if (isFork) {
                return !!prebuildCfg.pullRequestsFromForks;
            } else {
                return !!prebuildCfg.pullRequests;
            }
        } else if (isDefaultBranch) {
            return !!prebuildCfg.master;
        } else {
            return !!prebuildCfg.branches;
        }
    }

    public shouldDo(
        cfg: WorkspaceConfig | undefined,
        action: 'addCheck' | 'addBadge' | 'addLabel' | 'addComment',
    ): boolean {
        const config = this.mergeWithDefaultConfig(cfg);
        const prebuildCfg = config.prebuilds!;

        if (typeof prebuildCfg === 'boolean') {
            return !!prebuildCfg;
        }

        if (action === 'addCheck') {
            return !!prebuildCfg.addCheck;
        } else if (action === 'addBadge') {
            return !!prebuildCfg.addBadge;
        } else if (action === 'addLabel') {
            return !!prebuildCfg.addLabel;
        } else if (action === 'addComment') {
            return !!prebuildCfg.addComment;
        } else {
            log.warn('In GitHub app we asked whether we should do an unknown action. This is a bug!', { action });
            return false;
        }
    }
}
