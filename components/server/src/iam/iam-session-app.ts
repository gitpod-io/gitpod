/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as express from "express";
import { SessionHandlerProvider } from "../session-handler";
import { Authenticator } from "../auth/authenticator";
import { UserService } from "../user/user-service";

@injectable()
export class IamSessionApp {
    @inject(SessionHandlerProvider)
    protected readonly sessionHandlerProvider: SessionHandlerProvider;
    @inject(Authenticator)
    protected readonly authenticator: Authenticator;
    @inject(UserService)
    protected readonly userService: UserService;

    public getMiddlewares() {
        return [express.json(), this.sessionHandlerProvider.sessionHandler, ...this.authenticator.initHandlers];
    }

    public create(): express.Application {
        const app = express();
        this.getMiddlewares().forEach((middleware) => {
            app.use(middleware);
        });

        app.post("/session", async (req: express.Request, res: express.Response) => {
            try {
                await this.doCreateSession(req);
                res.status(200).json();
            } catch (error) {
                res.status(500).json({ error, message: error.message });
            }
        });

        return app;
    }

    protected async doCreateSession(req: express.Request) {
        const user = await this.userService.createUser({
            identity: {
                authId: "fake-id-" + Date.now(),
                authName: "FakeUser",
                authProviderId: "oidc1",
                primaryEmail: "fake@email.io",
            },
            userUpdate: (user) => {
                user.name = "FakeUser";
                user.fullName = "Fake User";
                user.avatarUrl = "https://github.com/github.png";
            },
        });

        await new Promise<void>((resolve, reject) => {
            req.login(user, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}
