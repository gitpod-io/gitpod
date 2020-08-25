/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export const StorageClient = Symbol("StorageClient")

export interface StorageClient {
    // deleteBucket deletes a particular bucket and its content
    deleteBucket(bucketName: string): Promise<void>;

    // deleteObjects deletes storage objects starting with the prefix
    deleteObjects(bucketName: string, prefix: string): Promise<void>;

    // createSignedUrl produces a URL from which one can download/to which one can push data
    createSignedUrl(bucketName: string, objectPath: string, action: "write" | "read", opts?: CreateSignedUrlOptions): Promise<string>;

    // getHash produces a hash of the of storage object
    getHash(bucketName: string, objectPath: string): Promise<string>;

    // ensureBucketExists makes sure the bucket exists and creates it if needed
    ensureBucketExists(bucketName: string): Promise<void>;
}

export interface CreateSignedUrlOptions {
    // createBucket, if true, ensures the bucket exists prior to signing the URL
    createBucket?: boolean

    // promptSaveAs changes the filename of the file for read actions. Has no effect for write operations.
    promptSaveAs?: string
}