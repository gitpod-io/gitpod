/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { StorageClient } from "../../storage/storage-client";

@injectable()
export class StorageClientMock implements StorageClient {
    async deleteUserContent(ownerId: string): Promise<void> {
        // do nothing
    }
    deleteWorkspaceBackups(ownerId: string, workspaceId: string, includeSnapshots: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }
    createWorkspaceContentDownloadUrl(ownerId: string, workspaceId: string): Promise<string> {
        throw new Error("Method not implemented.");
    }
    createPluginUploadUrl(bucket: string, objectPath: string): Promise<string> {
        throw new Error("Method not implemented.");
    }
    createPluginDownloadUrl(bucket: string, objectPath: string): Promise<string> {
        throw new Error("Method not implemented.");
    }
    getPluginHash(bucketName: string, objectPath: string): Promise<string> {
        throw new Error("Method not implemented.");
    }
    workspaceSnapshotExists(ownerId: string, workspaceId: string, snapshotUrl: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}
