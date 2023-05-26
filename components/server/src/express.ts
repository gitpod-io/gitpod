/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthFlow } from "./auth/auth-provider";
import * as session from "express-session";

declare module "express-session" {
    interface SessionData {
        authFlow?: AuthFlow;
    }
}
/* shortcut helper type */
export type Session = session.Session & Partial<session.SessionData>;
