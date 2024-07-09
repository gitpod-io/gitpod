/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { postConstruct, injectable } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GitLabApp {
    constructor() {}

    private _router = express.Router();
    public static path = "/apps/gitlab/";

    @postConstruct()
    protected init() {
        /**
         * see https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#configure-your-webhook-receiver-endpoint
         * for recommendation on creating webhook receivers:
         *
         *  - ignore unrecognized event payloads
         *  - never return 500 status responses if the event has been handled
         *  - prefer to return 200; indicate that the webhook is asynchronous by returning 201
         *  - to support fast response times, perform I/O or computationally intensive operations asynchronously
         *  - if a webhook fails repeatedly, it may be disabled automatically
         *  - webhooks that return failure codes in the 4xx range are understood to be misconfigured, and these are disabled (permanently)
         */
        this._router.post("/", async (req, res) => {
            const eventType = req.header("X-Gitlab-Event");
            const secretToken = req.header("X-Gitlab-Token");
            const context = req.body as GitLabPushHook;

            // trim commits to avoid DB pollution
            // https://github.com/gitpod-io/gitpod/issues/11578
            context.commits = [];

            if (eventType !== "Push Hook" || !secretToken) {
                log.warn("Unhandled GitLab event.", { event: eventType, secretToken: !!secretToken });
                res.status(200).send("Unhandled event.");
                return;
            } else if (eventType === "Push Hook") {
                log.debug("GitLab push event received, but not handling it", { event: eventType, context });
                res.status(200).send("Unhandled event.");
                return;
            }
        });
    }

    get router(): express.Router {
        return this._router;
    }
}

interface GitLabPushHook {
    object_kind: "push";
    before: string;
    after: string; // commit
    ref: string; // e.g. "refs/heads/master"
    user_avatar: string;
    user_name: string;
    project: GitLabProject;
    repository: GitLabRepository;
    commits: GitLabCommit[];
}

interface GitLabCommit {
    id: string;
    title: string;
    message: string;
    url: string;
    author: {
        name: string;
        email: string;
    };
    // modified
    // added
    // removed
}

interface GitLabRepository {
    name: string;
    git_http_url: string; // e.g. http://example.com/mike/diaspora.git
    visibility_level: number;
}

interface GitLabProject {
    id: number;
    namespace: string;
    name: string;
    path_with_namespace: string; // e.g. "mike/diaspora"
    git_http_url: string; // e.g. http://example.com/mike/diaspora.git
    web_url: string; // e.g. http://example.com/mike/diaspora
    visibility_level: number;
    avatar_url: string | null;
}
