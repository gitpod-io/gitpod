/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { Config } from "../config";
import * as Webhooks from "@octokit/webhooks";
import { createNodeMiddleware } from "@octokit/webhooks";
import { Application as App } from "express";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { GithubSubscriptionReconciler } from "./subscription-reconciler";

/**
 * Make sure that the webhook secret you set in GitHub matches what's in your
 * values.yaml file (GITPOD_GITHUB_APP_WEBHOOK_SECRET) - it's not a bad idea to
 * look at those values to begin with.
 */

@injectable()
export class GithubEndpointController {
    @inject(Config) protected readonly config: Config;
    @inject(GithubSubscriptionReconciler) protected readonly reconciler: GithubSubscriptionReconciler;

    public register(path: string, app: App) {
        const webhooks = new Webhooks.Webhooks({ secret: this.config.githubAppWebhookSecret });
        webhooks.on("marketplace_purchase", (evt) => {
            log.debug("incoming event", {
                event: `marketplace_purchase.${evt.payload.action}`,
                githubUser: evt.payload.marketplace_purchase.account.login,
            });
            this.reconciler
                .handleIncomingEvent(evt)
                .catch((err) => log.error("error while processing GitHub marketplace event", { err, evt }));
        });
        app.use(createNodeMiddleware(webhooks, { path }));
    }
}
