/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from "inversify";
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { Branding } from "@gitpod/gitpod-protocol";
import { Deferred } from "@theia/core/lib/common/promise-util";


@injectable()
export class GitpodBranding {

    protected brandingPromise = new Deferred<Branding>();
    @inject(GitpodServiceProvider) protected serviceProvider: GitpodServiceProvider;

    @postConstruct()
    protected async init() {
        const service = await this.serviceProvider.getService();
        this.brandingPromise.resolve(await service.server.getBranding());
    }

    get branding(): Promise<Branding> {
        return this.brandingPromise.promise;
    }

}