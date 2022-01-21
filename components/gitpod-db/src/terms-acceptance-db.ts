/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TermsAcceptanceEntry } from '@gitpod/gitpod-protocol';

export const TermsAcceptanceDB = Symbol('TermsAcceptanceDB');
export interface TermsAcceptanceDB {
  getAcceptedRevision(userId: string): Promise<TermsAcceptanceEntry | undefined>;
  updateAcceptedRevision(userId: string, revision: string): Promise<void>;
}
