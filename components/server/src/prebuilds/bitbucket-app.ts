/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { postConstruct, injectable } from "inversify";

@injectable()
export class BitbucketApp {
    constructor() {}

    private _router = express.Router();
    public static path = "/apps/bitbucket/";

    @postConstruct()
    protected init() {
        this._router.post("/", async (req, res) => {
            try {
                if (req.header("X-Event-Key") === "repo:push") {
                    const secretToken = req.query["token"] as string;
                    if (!secretToken) {
                        throw new Error("No secretToken provided.");
                    }

                    console.warn("Bitbucket push event received, but not handling it");
                } else {
                    console.warn(`Ignoring unsupported bitbucket event: ${req.header("X-Event-Key")}`);
                }
            } catch (err) {
                console.error(`Couldn't handle request.`, err, { headers: req.headers });
            } finally {
                // we always respond with OK, when we received a valid event.
                res.sendStatus(200);
            }
        });
    }

    get router(): express.Router {
        return this._router;
    }
}
