/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

declare module "@octokit/app" {
    import LRU = require("lru-cache");

    interface AppOptions {
        id: string;
        privateKey: string;
        baseUrl?: string;
        cache?: LRU.Cache<any, any>;
    }
    interface getJWTOptions {
        installation_id: string;
    }

    interface getInstallationAccessTokenOptions {
        installation_id: string;
    }

    // Not really a class, but it is how they say it should be used in the readme.
    // In TypeScript, you cannot use the `new` keyword on functions (excluding old-style classes using functions and prototype), only on classes
    class App {
        constructor(options: AppOptions);
        getSignedJsonWebToken(options?: getJWTOptions): Promise<string>;
        getInstallationAccessToken(options?: getInstallationAccessTokenOptions): Promise<string>;
    }

    export = App;
}
