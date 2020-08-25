/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { Storage, GetSignedUrlConfig } from "@google-cloud/storage";
import { Response } from 'request';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { StorageClient, CreateSignedUrlOptions } from "./storage-client";

export namespace GCloudStorageClient {
    export interface Params {
        projectId: string;
        stage: string;
        region: string;
        keyFilename: string;
    }
}

@injectable()
export class GCloudStorageClient implements StorageClient {

    static URL_EXPIRES_IN_SECONDS = 600;

    protected authenticatedStorage: Storage;

    constructor(protected params: GCloudStorageClient.Params) {
        const { keyFilename, projectId } = params;
        this.authenticatedStorage = new Storage({
            keyFilename,
            projectId
        });
    }

    get storage(): Storage {
        return this.authenticatedStorage;
    }

    async deleteBucket(bucketName: string): Promise<any> {
        const { response, err } = await this.try(() => this.storage.bucket(bucketName).delete().then(responses => responses[0]));
        if (response) {
            this.checkStatus(response, 'delete bucket', [204, 404])
        } else if (err) {
            throw err;
        }
    }

    async deleteObjects(bucketName: string, prefix: string): Promise<any> {
        await this.storage.bucket(bucketName).deleteFiles({
            prefix,
            autoPaginate: true
        })
        // TODO: sure to not handle errors?
    }

    async createSignedUrl(bucketName: string, objectPath: string, action: "write" | "read", options?: CreateSignedUrlOptions): Promise<string> {
        const opts = options || {};
        if (opts.createBucket) {
            await this.ensureBucketExists(bucketName);
        }

        const config: GetSignedUrlConfig = {
            action,
            contentType: "*/*",
            expires: Date.now() + GCloudStorageClient.URL_EXPIRES_IN_SECONDS * 1000
        };
        if (action === 'read' && !!opts.promptSaveAs) {
            config.promptSaveAs = opts.promptSaveAs;
        }

        const bucket = this.storage.bucket(bucketName);
        const object = bucket.file(objectPath);
        const [url] = await object.getSignedUrl(config);
        return url;
    }

    async getHash(bucketName: string, objectPath: string) {
        const object = this.storage.bucket(bucketName).file(objectPath);
        const [metadata] = await object.getMetadata();
        const hash = metadata.md5Hash;
        return hash;
    }

    async ensureBucketExists(bucketName: string): Promise<void> {
        const bucket = this.storage.bucket(bucketName)

        const [exists] = await bucket.exists();
        if (exists) {
            return;
        }

        await this.storage.createBucket(bucketName, {
            location: this.params.region
        });
    }

    protected async try<R>(call: () => Promise<R>): Promise<{ response?: R, err?: any }> {
        try {
            const response = await call();
            return { response };
        } catch (err) {
            return { response: err.response, err };
        }
    }

    protected checkStatus(response: Response, description: string, okStatusCodes: number[] = []) {
        if (okStatusCodes.some(s => s === response.statusCode)) {
            log.debug(`Response for ${description} was ${response.statusCode}, ok.`);
            return;
        }
        if (response.statusCode !== 200) {
            throw new Error(`Unable to ${description}, status code: ${response.statusCode}.`);
        }
    }
}
