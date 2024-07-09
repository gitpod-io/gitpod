/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { postConstruct, injectable } from "inversify";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GitHubEnterpriseApp {
    constructor() {}

    private _router = express.Router();
    public static path = "/apps/ghe/";

    @postConstruct()
    protected init() {
        this._router.post("/", async (req, res) => {
            const event = req.header("X-Github-Event");
            if (event === "push") {
                const payload = req.body as GitHubEnterprisePushPayload;
                const span = TraceContext.startSpan("GitHubEnterpriseApp.handleEvent", {});
                span.setTag("payload", payload);

                log.debug("GitHub Enterprise push event received, ignoring it", { event });
                span.finish();
            } else {
                log.info("Unknown GitHub Enterprise event received", { event });
            }
            res.send("OK");
        });
    }

    get router(): express.Router {
        return this._router;
    }
}

interface GitHubEnterprisePushPayload {
    ref: string;
    after: string;
    repository: {
        url: string;
        clone_url: string;
    };
    sender: {
        login: string;
        id: string;
    };
}
