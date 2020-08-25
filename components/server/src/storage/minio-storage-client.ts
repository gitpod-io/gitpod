/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { StorageClient, CreateSignedUrlOptions } from "./storage-client";
import { Client } from "minio";

@injectable()
export class MinIOStorageClient implements StorageClient {

    constructor(protected readonly client: Client, protected readonly region: string) { }

    deleteBucket(bucketName: string): Promise<void> {
        return this.client.removeBucket(bucketName);
    }

    async deleteObjects(bucketName: string, prefix: string): Promise<void> {
        const objStream = await this.client.listObjects(bucketName, prefix);
        const items = await new Promise<string[]>((resolve, reject) => {
            const r: string[] = [];
            objStream.on('data', i => r.push(i.name));
            objStream.on('error', reject);
            objStream.on('end', () => resolve(r));
        })

        await this.client.removeObjects(bucketName, items);
    }

    async createSignedUrl(bucketName: string, objectPath: string, action: "write" | "read", options?: CreateSignedUrlOptions): Promise<string> {
        const opts = options || {};
        if (!!opts.createBucket) {
            await this.ensureBucketExists(bucketName);
        }

        let method = {
            "write": "PUT",
            "read": "GET"
        }[action];

        const url = await this.client.presignedUrl(method, bucketName, objectPath);
        return decodeURI(url);
    }

    async getHash(bucketName: string, objectPath: string): Promise<string> {
        const item = await this.client.statObject(bucketName, objectPath);
        return item.etag;
    }

    async ensureBucketExists(bucketName: string): Promise<void> {
        if (await this.client.bucketExists(bucketName)) {
            return;
        }

        await this.client.makeBucket(bucketName, this.region);
    }

}