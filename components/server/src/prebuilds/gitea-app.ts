/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as express from 'express';
import { postConstruct, injectable, inject } from 'inversify';
import { ProjectDB, TeamDB, UserDB } from '@gitpod/gitpod-db/lib';
import { Project, User, StartPrebuildResult } from '@gitpod/gitpod-protocol';
import { PrebuildManager } from '../prebuilds/prebuild-manager';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { TokenService } from '../../../src/user/token-service';
import { HostContextProvider } from '../../../src/auth/host-context-provider';
// import { GiteaService } from './gitea-service';

@injectable()
export class GiteaApp {

    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(PrebuildManager) protected readonly prebuildManager: PrebuildManager;
    @inject(TokenService) protected readonly tokenService: TokenService;
    @inject(HostContextProvider) protected readonly hostCtxProvider: HostContextProvider;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;

    protected _router = express.Router();
    public static path = '/apps/gitea/';

    @postConstruct()
    protected init() {
        // TODO
    }

    protected async findUser(ctx: TraceContext, context: GiteaPushHook, req: express.Request): Promise<User> {
        // TODO
        return {} as User;
    }

    protected async handlePushHook(ctx: TraceContext, body: GiteaPushHook, user: User): Promise<StartPrebuildResult | undefined> {
        // TODO
        return undefined;
    }

    /**
     * Finds the relevant user account and project to the provided webhook event information.
     *
     * First of all it tries to find the project for the given `cloneURL`, then it tries to
     * find the installer, which is also supposed to be a team member. As a fallback, it
     * looks for a team member which also has a gitlab.com connection.
     *
     * @param cloneURL of the webhook event
     * @param webhookInstaller the user account known from the webhook installation
     * @returns a promise which resolves to a user account and an optional project.
     */
     protected async findProjectAndOwner(cloneURL: string, webhookInstaller: User): Promise<{ user: User, project?: Project }> {
        // TODO
        return {} as { user: User, project?: Project };
    }

    protected createContextUrl(body: GiteaPushHook) {
        // TODO
        return {};
    }

    get router(): express.Router {
        return this._router;
    }

    protected getBranchFromRef(ref: string): string | undefined {
        const headsPrefix = "refs/heads/";
        if (ref.startsWith(headsPrefix)) {
            return ref.substring(headsPrefix.length);
        }

        return undefined;
    }
}

interface GiteaPushHook {
}

// interface GiteaRepository {
// }

// interface GiteaProject {}