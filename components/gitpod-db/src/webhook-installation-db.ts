/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { DBWebhookInstallation } from "./typeorm/entity/db-webhook-installation";

export const WebhookInstallationDB = Symbol("WebhookInstallationDB");
export interface WebhookInstallationDB {
    createInstallation(installation: DBWebhookInstallation): Promise<void>;
    deleteInstallation(id: string): Promise<DBWebhookInstallation | undefined>;
    findByProjectId(projectId: string): Promise<DBWebhookInstallation | undefined>;
}
