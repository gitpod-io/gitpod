/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { UserDB } from '@gitpod/gitpod-db/lib/user-db';
import * as express from 'express';
import { User, Identity } from "@gitpod/gitpod-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { UserService } from "./user-service";
import { SessionHandlerProvider } from "../session-handler";
import { GitpodCookie } from "../auth/gitpod-cookie";
import { Config } from "../config";

export function testControllerApp(sessionHandlerProvider: SessionHandlerProvider, testController: TestController): express.Application {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(sessionHandlerProvider.sessionHandler);
    app.use(testController.router);
    return app;
}

export interface GitHubLoginParameters {
    identity: Identity;
    profile: { fullName?: string, avatarUrl?: string };
    token: {
        value: string;
        scopes: string[];
    };
}

const TEST_CASES: { [key: string]: GitHubLoginParameters } = {
    "newuser": {
        identity: {
            authId: "50396837",
            authName: "testfoxgpl",
            authProviderId: "Public-GitHub",
            deleted: false,
            primaryEmail: "gero.posmyk-leinemann+testfoxgpl@typefox.io",
            readonly: false,
        },
        // TODO[gpl] We need to get these from somewhere...
        token: {
            scopes: [],
            value: ""
        },
        profile: {
            fullName: "testfoxgpl",
            avatarUrl: "https://avatars.githubusercontent.com/u/32448529"
        }
    },
};

/**
 * This controller serves routes that are used for _internal testing_ only.
 * It should _not_ be exposed on the public facing ports/express apps. It's meant to be accessed via `kubectl port-forward` only.
 */
@injectable()
export class TestController {
    @inject(Config) protected readonly config: Config;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(GitpodCookie) protected gitpodCookie: GitpodCookie;
    @inject(UserService) protected readonly userService: UserService;

    get router(): express.Router {
        const router = express.Router();

        /**
         * This handler allows to login as a testuser with a static GitHub token to avoid the OAuth flow (which do not work with automated tests).
         * Access is guarded by a deploy-time loginToken.
         */
        router.post("/login/github", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            log.info({ sessionId: req.sessionID }, "(TestAuth) A TESTUSER started the login process", { 'login-flow': true });

            try {
                const testToken = req.headers["test-token"];
                if (this.config.testToken !== testToken) {
                    res.sendStatus(401);
                    return
                }

                // Create and set testuser
                const testCaseId = String(req.body);
                const params = TEST_CASES[testCaseId];
                if (!params) {
                    res.sendStatus(404);
                    return;
                }

                const user = await this.createTestUserLogin(params);
                req.session!.passport = { user: user.id };  // mimick the shape of a successful login

                // Save session to DB
                await new Promise<void>((resolve, reject) => {
                    req.session!.save((err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
                log.info({ sessionId: req.sessionID, userId: user.id }, "(TestAuth) Successfully created/updated a TESTUSER.", { 'login-flow': true });

                // Send response
                this.gitpodCookie.setCookie(res);
                res.send({
                    userId: user.id,
                    cookie: SessionHandlerProvider.generateCookieForSession(this.config, req.session!)
                });
            } catch(err) {
                log.error({ sessionId: req.sessionID }, "(TestAuth) Error during the TESTUSER login process", err);
                res.sendStatus(500);
            }
        });

        return router;
    }

    protected async createTestUserLogin({ identity, profile, token: tokenConfig }: GitHubLoginParameters): Promise<User> {
        // create user with token
        const now = new Date().toISOString();
        const token = {
            value: tokenConfig.value,
            scopes: tokenConfig.scopes,
            updateDate: now
        };
        let user = await this.userDb.findUserByIdentity(identity);
        if (!user) {
            user = await this.userService.createUser({ identity, token });
        }

        // Hard overwrite existing identity to give a clean state
        user.identities = [identity];

        user.name = identity.authName;
        if (profile.fullName) {
            user.fullName = profile.fullName;
        }
        if (profile.avatarUrl) {
            user.avatarUrl = profile.avatarUrl;
        }

        // Update token, scopes, and email
        await this.userDb.storeUser(user);
        return user;
    }
}
