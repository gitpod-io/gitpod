/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { WebhookEvent } from "@gitpod/gitpod-protocol";

export const WebhookEventDB = Symbol("WebhookEventDB");
export interface WebhookEventDB {
    createEvent(parts: Omit<WebhookEvent, "id" | "creationTime">): Promise<WebhookEvent>;
    updateEvent(id: string, update: Partial<WebhookEvent>): Promise<void>;
    findByCloneUrl(cloneUrl: string, limit?: number): Promise<WebhookEvent[]>;
    deleteOldEvents(ageInDays: number, limit?: number): Promise<void>;
}
