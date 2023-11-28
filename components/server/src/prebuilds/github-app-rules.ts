/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { WorkspaceConfig, GithubAppConfig } from "@gitpod/gitpod-protocol";
import deepmerge from "deepmerge";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

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
        const result: GithubAppConfig = defaultConfig;

        if (!cfg || !cfg.github) {
            return result;
        }

        return deepmerge(defaultConfig, cfg.github);
    }

    /**
     *
     * @deprecated
     */
    public shouldRunPrebuild(
        config: WorkspaceConfig | undefined,
        isDefaultBranch: boolean,
        isPR: boolean,
        isFork: boolean,
    ): boolean {
        if (!config || !config._origin || config._origin !== "repo") {
            // we demand an explicit gitpod config
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
            }
            return !!prebuildCfg.pullRequests;
        }
        if (isDefaultBranch) {
            return !!prebuildCfg.master;
        }
        return !!prebuildCfg.branches;
    }

    public shouldDo(
        cfg: WorkspaceConfig | undefined,
        action: "addCheck" | "addBadge" | "addLabel" | "addComment",
    ): boolean {
        const config = this.mergeWithDefaultConfig(cfg);
        const prebuildCfg = config.prebuilds!;

        if (typeof prebuildCfg === "boolean") {
            return !!prebuildCfg;
        }

        if (action === "addCheck") {
            return !!prebuildCfg.addCheck;
        }
        if (action === "addBadge") {
            return !!prebuildCfg.addBadge;
        }
        if (action === "addLabel") {
            return !!prebuildCfg.addLabel;
        }
        if (action === "addComment") {
            return !!prebuildCfg.addComment;
        }
        log.warn("In GitHub app we asked whether we should do an unknown action. This is a bug!", { action });
        return false;
    }
}
