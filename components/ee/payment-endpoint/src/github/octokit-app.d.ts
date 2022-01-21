/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

declare module '@octokit/app' {
  import LRU = require('lru-cache');

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
