/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as express from "express";
import { Config } from "../config";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class FeatureFlagController {
    @inject(Config) protected readonly config: Config;

    get apiRouter(): express.Router {
        const router = express.Router();
        this.addSlowDatabaseFeatureFlagHandler(router);
        return router;
    }

    protected addSlowDatabaseFeatureFlagHandler(router: express.Router) {
        router.get("/slow-database", async (req, res) => {
            try {
                if (!User.is(req.user)) {
                    res.setHeader("X-Gitpod-Slow-Database", "false");
                    return;
                }

                const flagValue = await getExperimentsClientForBackend().getValueAsync("slow_database", false, {
                    user: req.user,
                });
                res.setHeader("X-Gitpod-Slow-Database", flagValue.toString());
            } catch (error) {
                log.error(`failed to retrieve value of 'slow_database' feature flag: ${error.message}`);
                res.setHeader("X-Gitpod-Slow-Database", "false");
            } finally {
                res.status(200);
                res.end();
            }
        });
    }
}
