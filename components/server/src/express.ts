/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User as GitpodUser } from '@gitpod/gitpod-protocol';
import { AuthFlow } from './auth/auth-provider';
import { TosFlow } from './terms/tos-flow';
import * as session from 'express-session';

// use declaration merging (https://www.typescriptlang.org/docs/handbook/declaration-merging.html) to augment the standard passport/express definitions
declare global {
  namespace Express {
    export interface User extends GitpodUser {}
  }
}

declare module 'express-session' {
  interface SessionData {
    tosFlowInfo?: TosFlow;
    authFlow?: AuthFlow;
  }
}
/* shortcut helper type */
export type Session = session.Session & Partial<session.SessionData>;
