/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

declare module 'passport-dummy' {
  import * as passport from 'passport';

  export class Strategy extends passport.Strategy {
    constructor(verify: (done: (error: any, user: any) => void) => void);
  }
}
