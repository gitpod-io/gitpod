/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export const UserMessageViewsDB = Symbol('UserMessageViewsDB');

export interface UserMessageViewsDB {
  didViewMessage(userId: string, messageId: string): Promise<boolean>;
  markAsViewed(userId: string, messageIds: string[]): Promise<void>;
}
