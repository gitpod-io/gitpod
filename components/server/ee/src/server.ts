/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as express from "express";
import { Server } from "../../src/server";
import { inject } from "inversify";
import { GitpodClient, GitpodServer } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { GitLabApp } from "./prebuilds/gitlab-app";
import { BitbucketApp } from "./prebuilds/bitbucket-app";
import { GithubApp } from "./prebuilds/github-app";
import { SnapshotService } from "./workspace/snapshot-service";
import { GitHubEnterpriseApp } from "./prebuilds/github-enterprise-app";
import { BitbucketServerApp } from "./prebuilds/bitbucket-server-app";

export class ServerEE<C extends GitpodClient, S extends GitpodServer> extends Server<C, S> {
    @inject(GithubApp) protected readonly githubApp: GithubApp;
    @inject(GitLabApp) protected readonly gitLabApp: GitLabApp;
    @inject(BitbucketApp) protected readonly bitbucketApp: BitbucketApp;
    @inject(BitbucketServerApp) protected readonly bitbucketServerApp: BitbucketServerApp;
    @inject(SnapshotService) protected readonly snapshotService: SnapshotService;
    @inject(GitHubEnterpriseApp) protected readonly gitHubEnterpriseApp: GitHubEnterpriseApp;

    public async init(app: express.Application) {
        await super.init(app);

        // Start Snapshot Service
        await this.snapshotService.start();
    }

    protected async registerRoutes(app: express.Application): Promise<void> {
        await super.registerRoutes(app);

        if (this.config.githubApp?.enabled && this.githubApp.server) {
            log.info("Registered GitHub app at /apps/github");
            app.use("/apps/github/", this.githubApp.server?.expressApp);
            log.debug(`GitHub app ready under ${this.githubApp.server.expressApp.path()}`);
        } else {
            log.info("GitHub app disabled");
        }

        log.info("Registered GitLab app at " + GitLabApp.path);
        app.use(GitLabApp.path, this.gitLabApp.router);

        log.info("Registered Bitbucket app at " + BitbucketApp.path);
        app.use(BitbucketApp.path, this.bitbucketApp.router);

        log.info("Registered GitHub EnterpriseApp app at " + GitHubEnterpriseApp.path);
        app.use(GitHubEnterpriseApp.path, this.gitHubEnterpriseApp.router);

        log.info("Registered Bitbucket Server app at " + BitbucketServerApp.path);
        app.use(BitbucketServerApp.path, this.bitbucketServerApp.router);
    }
}
