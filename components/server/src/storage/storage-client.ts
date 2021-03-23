/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export const StorageClient = Symbol("StorageClient")

export interface StorageClient {
    // deleteUserContent deletes the bucket of a user
    deleteUserContent(ownerId: string): Promise<void>;

    // deleteWorkspaceBackups deletes storage objects for a given workspace
    deleteWorkspaceBackups(ownerId: string, workspaceId: string, includeSnapshots: boolean): Promise<void>;

    // createWorkspaceContentDownloadUrl creates a signed URL from which one can download workspace content
    createWorkspaceContentDownloadUrl(ownerId: string, workspaceId: string): Promise<string>;

    createPluginUploadUrl(bucket: string, objectPath: string): Promise<string>;
    createPluginDownloadUrl(bucket: string, objectPath: string): Promise<string>;

    // getHash produces a hash of the of storage object
    getPluginHash(bucketName: string, objectPath: string): Promise<string>;
}
