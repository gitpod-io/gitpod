/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Server, Probot, Context } from "probot";
import { getPrivateKey } from "@probot/get-private-key";
import * as fs from "fs-extra";
import { injectable, inject } from "inversify";
import { Config } from "../config";
import { AppInstallationDB, UserDB, ProjectDB } from "@gitpod/gitpod-db/lib";
import express from "express";
import { log, LogrusLogLevel } from "@gitpod/gitpod-protocol/lib/util/logging";
import { PrebuildStatusMaintainer } from "./prebuilt-status-maintainer";
import { Options, ApplicationFunctionOptions } from "probot/lib/types";
import { asyncHandler } from "../express-util";
import { ApplicationError, ErrorCode } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ProjectsService } from "../projects/projects-service";
import { SYSTEM_USER, SYSTEM_USER_ID } from "../authorization/authorizer";
import { runWithSubjectId, runWithRequestContext } from "../util/request-context";

/**
 * GitHub app urls:
 *    User authorization callback URL: https://gitpod.io/install-github-app
 *    Setup URL:                       https://gitpod.io/install-github-app
 *    Webhook URL:                     https://gitpod.io/apps/github
 *
 * Make sure that the webhook secret you set in GitHub matches what's in your
 * values.yaml file (GITPOD_GITHUB_APP_WEBHOOK_SECRET) - it's not a bad idea to
 * look at those values to begin with.
 */
@injectable()
export class GithubApp {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(PrebuildStatusMaintainer) private readonly statusMaintainer: PrebuildStatusMaintainer,
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(AppInstallationDB) private readonly appInstallationDB: AppInstallationDB,
        @inject(ProjectsService) private readonly projectService: ProjectsService,
    ) {
        if (config.githubApp?.enabled) {
            const logLevel = LogrusLogLevel.getFromEnv() ?? "info";

            this.server = new Server({
                Probot: Probot.defaults({
                    appId: config.githubApp.appId,
                    privateKey: GithubApp.loadPrivateKey(config.githubApp.certPath),
                    secret: config.githubApp.webhookSecret,
                    logLevel: GithubApp.mapToGitHubLogLevel(logLevel),
                    baseUrl: config.githubApp.baseUrl,
                }),
            });
            log.debug("Starting GitHub app integration", {
                appId: config.githubApp.appId,
                cert: config.githubApp.certPath,
                secret: config.githubApp.webhookSecret,
            });

            this.server.load(this.buildApp.bind(this)).catch((err) => log.error("error loading probot server", err));
        }
    }
    readonly server: Server | undefined;

    private async buildApp(app: Probot, options: ApplicationFunctionOptions) {
        this.statusMaintainer.start(async (id) => {
            try {
                const githubApi = await app.auth(id);
                return githubApi;
            } catch (error) {
                log.error("Failes to authorize GH API for Probot", { error });
            }
        });

        // Backward-compatibility: Redirect old badge URLs (e.g. "/api/apps/github/pbs/github.com/gitpod-io/gitpod/5431d5735c32ab7d5d840a4d1a7d7c688d1f0ce9.svg")
        options.getRouter &&
            options.getRouter("/pbs").get("/*", (req: express.Request, res: express.Response) => {
                res.redirect(301, this.getBadgeImageURL());
            });

        app.on("installation.created", (ctx: Context<"installation.created">) => {
            handleEvent(ctx.name, async () => {
                const targetAccountName = `${ctx.payload.installation.account.login}`;
                const installationId = `${ctx.payload.installation.id}`;

                // cf. https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#installation
                const authId = `${ctx.payload.sender.id}`;

                const user = await this.userDB.findUserByIdentity({
                    authProviderId: this.config.githubApp?.authProviderId || "unknown",
                    authId,
                });
                const userId = user ? user.id : undefined;
                await this.appInstallationDB.recordNewInstallation(
                    "github",
                    "platform",
                    installationId,
                    userId,
                    authId,
                );
                log.debug({ userId }, "New installation recorded", { userId, authId, targetAccountName });
            });
        });
        app.on("installation.deleted", (ctx: Context<"installation.deleted">) => {
            handleEvent(ctx.name, async () => {
                const installationId = `${ctx.payload.installation.id}`;
                await this.appInstallationDB.recordUninstallation("github", "platform", installationId);
            });
        });

        app.on("repository.renamed", (ctx: Context<"repository.renamed">) => {
            handleEvent(ctx.name, async () => {
                const { action, repository, installation } = ctx.payload;
                if (!installation) {
                    return;
                }
                if (action === "renamed") {
                    // HINT(AT): This is undocumented, but the event payload contains something like
                    // "changes": { "repository": { "name": { "from": "test-repo-123" } } }
                    // To implement this in a more robust way, we'd need to store `repository.id` with the project, next to the cloneUrl.
                    const oldName = (ctx.payload as any)?.changes?.repository?.name?.from;
                    if (oldName) {
                        const projects = await runWithSubjectId(SYSTEM_USER, async () =>
                            this.projectService.findProjectsByCloneUrl(
                                SYSTEM_USER_ID,
                                `https://github.com/${repository.owner.login}/${oldName}.git`,
                            ),
                        );
                        for (const project of projects) {
                            project.cloneUrl = repository.clone_url;
                            await this.projectDB.storeProject(project);
                        }
                    }
                }
            });
            // TODO(at): handle deleted as well
        });

        options.getRouter &&
            options.getRouter("/reconfigure").get(
                "/",
                asyncHandler(async (req: express.Request, res: express.Response) => {
                    try {
                        const gh = await app.auth();
                        const data = await gh.apps.getAuthenticated();
                        const slug = data.data.slug;

                        const state = req.query.state;
                        res.redirect(`https://github.com/apps/${slug}/installations/new?state=${state}`);
                    } catch (error) {
                        console.error(error, { error });
                        res.status(500).send("GitHub App is not configured.");
                    }
                }),
            );
        options.getRouter &&
            options.getRouter("/setup").get("/", (req: express.Request, res: express.Response) => {
                const state = req.query.state;
                const installationId = req.query.installation_id;
                const setupAction = req.query.setup_action;
                const payload = { installationId, setupAction };
                req.query;

                if (state) {
                    const url = this.config.hostUrl
                        .with({
                            pathname: "/complete-auth",
                            search:
                                "message=payload:" + Buffer.from(JSON.stringify(payload), "utf-8").toString("base64"),
                        })
                        .toString();
                    res.redirect(url);
                } else {
                    const url = this.config.hostUrl
                        .with({ pathname: "install-github-app", search: `installation_id=${installationId}` })
                        .toString();
                    res.redirect(url);
                }
            });
    }

    private getBadgeImageURL(): string {
        return this.config.hostUrl.with({ pathname: "/button/open-in-gitpod.svg" }).toString();
    }
}

function handleEvent(eventName: string, p: () => Promise<any>): void {
    runWithRequestContext(
        {
            requestKind: "probot",
            requestMethod: eventName,
            signal: new AbortController().signal,
        },
        () => {
            p().catch((err) => {
                let logger = log.error;
                if (ApplicationError.hasErrorCode(err)) {
                    logger = ErrorCode.isUserError(err.code) ? log.info : log.error;
                }

                logger("Failed to handle github event", err);
            });
        },
    );
}

export namespace GithubApp {
    export function loadPrivateKey(filename: string | undefined): string | undefined {
        if (!filename) {
            return;
        }

        const isInTelepresence = !!process.env.TELEPRESENCE_ROOT;
        const ignoreTelepresence = !!process.env.TELEPRESENCE_ROOT_IGNORE;
        if (isInTelepresence && !ignoreTelepresence) {
            filename = `${process.env.TELEPRESENCE_ROOT}/${filename}`;
        }

        // loadPrivateKey is used in super call - must not be async
        if (fs.existsSync(filename)) {
            const key = getPrivateKey({ filepath: filename });
            if (key) {
                return key.toString();
            }
        }
    }

    export function mapToGitHubLogLevel(logLevel: LogrusLogLevel): Options["logLevel"] {
        switch (logLevel) {
            case "warning":
                return "warn";
            case "panic":
                return "fatal";
            default:
                return logLevel;
        }
    }
}
