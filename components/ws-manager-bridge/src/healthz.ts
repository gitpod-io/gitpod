/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as express from "express";

export const health = { isHealthy: false };

export function startHealthEndpoint() {
    const app = express();
    const port = 9090;

    app.get("/healthz", (req, res) => {
        if (health.isHealthy) {
            res.status(200).send("OK");
        } else {
            res.status(503).send("Not ready");
        }
    });

    app.listen(port, () => {
        console.log(`Healthz endpoint running on http://localhost:${port}`);
    });
}
