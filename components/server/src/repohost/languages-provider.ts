/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, Repository } from '@gitpod/gitpod-protocol';

export const LanguagesProvider = Symbol('LanguagesProvider');
export interface LanguagesProvider {
  getLanguages(repository: Repository, user: User): Promise<object>;
}
