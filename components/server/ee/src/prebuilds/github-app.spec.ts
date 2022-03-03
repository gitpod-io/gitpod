/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Container, ContainerModule } from 'inversify';
import 'mocha';
import * as chai from 'chai';
import { GithubAppRules } from './github-app-rules';
import { GithubAppPrebuildConfig, WorkspaceConfig } from '@gitpod/gitpod-protocol';

const containerModule = new ContainerModule((bind) => {
    bind(GithubAppRules).toSelf().inSingletonScope();
});

const container = new Container();
container.load(containerModule);

describe('GitHub app', () => {
    it('should not run prebuilds without explicit configuration', async () => {
        const rules = container.get(GithubAppRules) as GithubAppRules;
        chai.assert.isFalse(rules.shouldRunPrebuild(undefined, true, false, false));
        chai.assert.isFalse(rules.shouldRunPrebuild(undefined, false, true, false));
        chai.assert.isFalse(rules.shouldRunPrebuild(undefined, false, false, false));
        chai.assert.isFalse(rules.shouldRunPrebuild(undefined, false, true, true));
    });

    it('should not run prebuilds without tasks to execute', async () => {
        const noTaskConfig: WorkspaceConfig = {
            tasks: [],
        };
        const rules = container.get(GithubAppRules) as GithubAppRules;
        chai.assert.isFalse(rules.shouldRunPrebuild(noTaskConfig, true, false, false));
        chai.assert.isFalse(rules.shouldRunPrebuild(noTaskConfig, false, true, false));
        chai.assert.isFalse(rules.shouldRunPrebuild(noTaskConfig, false, false, false));
        chai.assert.isFalse(rules.shouldRunPrebuild(noTaskConfig, false, true, true));
    });

    it('should behave well with individual configuration', async () => {
        const rules = container.get(GithubAppRules) as GithubAppRules;

        const checkConfig = function (pbcfg: GithubAppPrebuildConfig, expectation: boolean[]) {
            const cfg: WorkspaceConfig = {
                github: {
                    prebuilds: pbcfg,
                },
                tasks: [{ init: 'ls' }],
            };

            chai.assert.equal(
                rules.shouldRunPrebuild(cfg, true, false, false),
                expectation[0],
                `master prebuild check failed with ${JSON.stringify(pbcfg)}`,
            );
            chai.assert.equal(
                rules.shouldRunPrebuild(cfg, false, true, false),
                expectation[1],
                `PR prebuild check failed with ${JSON.stringify(pbcfg)}`,
            );
            chai.assert.equal(
                rules.shouldRunPrebuild(cfg, false, false, false),
                expectation[2],
                `branch prebuild check failed with ${JSON.stringify(pbcfg)}`,
            );
            chai.assert.equal(
                rules.shouldRunPrebuild(cfg, false, true, true),
                expectation[3],
                `PR from Fork prebuild check failed with ${JSON.stringify(pbcfg)}`,
            );
        };

        checkConfig({ branches: true }, [true, true, true, false]);
        checkConfig({ master: false }, [false, true, false, false]);
        checkConfig({ master: false, branches: true }, [false, true, true, false]);
        checkConfig({ pullRequests: false }, [true, false, false, false]);
        checkConfig({ pullRequests: false, master: false }, [false, false, false, false]);
        checkConfig({ pullRequests: true, pullRequestsFromForks: true }, [true, true, false, true]);
        checkConfig({ pullRequestsFromForks: true }, [true, true, false, true]);
    });
});
