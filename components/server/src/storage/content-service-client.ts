/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { DeleteUserContentRequest, DeleteUserContentResponse } from "@gitpod/content-service/lib/content_pb";
import {
    PluginDownloadURLRequest,
    PluginDownloadURLResponse,
    PluginHashRequest,
    PluginHashResponse,
    PluginUploadURLRequest,
    PluginUploadURLResponse,
} from "@gitpod/content-service/lib/ideplugin_pb";
import {
    DeleteWorkspaceRequest,
    DeleteWorkspaceResponse,
    WorkspaceSnapshotExistsRequest,
    WorkspaceSnapshotExistsResponse,
} from "@gitpod/content-service/lib/workspace_pb";
import { SnapshotUrl } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import {
    CachingContentServiceClientProvider,
    CachingIDEPluginClientProvider,
    CachingWorkspaceServiceClientProvider,
} from "../util/content-service-sugar";
import { StorageClient } from "./storage-client";

@injectable()
export class ContentServiceStorageClient implements StorageClient {
    @inject(CachingContentServiceClientProvider)
    private readonly contentServiceClientProvider: CachingContentServiceClientProvider;
    @inject(CachingWorkspaceServiceClientProvider)
    private readonly workspaceServiceClientProvider: CachingWorkspaceServiceClientProvider;
    @inject(CachingIDEPluginClientProvider)
    private readonly idePluginServiceClientProvider: CachingIDEPluginClientProvider;

    public async deleteUserContent(ownerId: string): Promise<void> {
        const request = new DeleteUserContentRequest();
        request.setOwnerId(ownerId);

        await new Promise<DeleteUserContentResponse>((resolve, reject) => {
            const client = this.contentServiceClientProvider.getDefault();
            client.deleteUserContent(request, (err: any, resp: DeleteUserContentResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
    }

    public async deleteWorkspaceBackups(
        ownerId: string,
        workspaceId: string,
        includeSnapshots: boolean,
    ): Promise<void> {
        const request = new DeleteWorkspaceRequest();
        request.setOwnerId(ownerId);
        request.setWorkspaceId(workspaceId);
        request.setIncludeSnapshots(includeSnapshots);

        await new Promise<DeleteWorkspaceResponse>((resolve, reject) => {
            const client = this.workspaceServiceClientProvider.getDefault();
            client.deleteWorkspace(request, (err: any, resp: DeleteWorkspaceResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
    }

    public async createPluginUploadUrl(bucket: string, objectPath: string): Promise<string> {
        const request = new PluginUploadURLRequest();
        request.setBucket(bucket);
        request.setName(objectPath);

        const response = await new Promise<PluginUploadURLResponse>((resolve, reject) => {
            const client = this.idePluginServiceClientProvider.getDefault();
            client.uploadURL(request, (err: any, resp: PluginUploadURLResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
        return decodeURI(response.toObject().url);
    }

    public async createPluginDownloadUrl(bucket: string, objectPath: string): Promise<string> {
        const request = new PluginDownloadURLRequest();
        request.setBucket(bucket);
        request.setName(objectPath);

        const response = await new Promise<PluginDownloadURLResponse>((resolve, reject) => {
            const client = this.idePluginServiceClientProvider.getDefault();
            client.downloadURL(request, (err: any, resp: PluginDownloadURLResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
        return decodeURI(response.toObject().url);
    }

    public async getPluginHash(bucketName: string, objectPath: string): Promise<string> {
        const request = new PluginHashRequest();
        request.setBucket(bucketName);
        request.setName(objectPath);

        const response = await new Promise<PluginHashResponse>((resolve, reject) => {
            const client = this.idePluginServiceClientProvider.getDefault();
            client.pluginHash(request, (err: any, resp: PluginHashResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
        return response.toObject().hash;
    }

    public async workspaceSnapshotExists(ownerId: string, workspaceId: string, snapshotUrl: string): Promise<boolean> {
        const { filename } = SnapshotUrl.parse(snapshotUrl);
        const response = await new Promise<WorkspaceSnapshotExistsResponse>((resolve, reject) => {
            const request = new WorkspaceSnapshotExistsRequest();
            request.setOwnerId(ownerId);
            request.setWorkspaceId(workspaceId);
            request.setFilename(filename);

            const client = this.workspaceServiceClientProvider.getDefault();
            client.workspaceSnapshotExists(request, (err: any, resp: WorkspaceSnapshotExistsResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
        return response.getExists();
    }
}
