/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContentServiceClient } from '@gitpod/content-service/lib/content_grpc_pb';
import { DeleteUserContentRequest, DeleteUserContentResponse } from "@gitpod/content-service/lib/content_pb";
import { IDEPluginServiceClient } from '@gitpod/content-service/lib/ideplugin_grpc_pb';
import { PluginDownloadURLRequest, PluginDownloadURLResponse, PluginHashRequest, PluginHashResponse, PluginUploadURLRequest, PluginUploadURLResponse } from "@gitpod/content-service/lib/ideplugin_pb";
import { WorkspaceServiceClient } from '@gitpod/content-service/lib/workspace_grpc_pb';
import { DeleteWorkspaceRequest, DeleteWorkspaceResponse, WorkspaceDownloadURLRequest, WorkspaceDownloadURLResponse, WorkspaceSnapshotExistsRequest, WorkspaceSnapshotExistsResponse } from "@gitpod/content-service/lib/workspace_pb";
import { SnapshotUrl } from '@gitpod/gitpod-protocol';
import { inject, injectable } from "inversify";
import { StorageClient } from "./storage-client";

@injectable()
export class ContentServiceStorageClient implements StorageClient {

    @inject(ContentServiceClient) private readonly contentServiceClient: ContentServiceClient;
    @inject(WorkspaceServiceClient) private readonly workspaceServiceClient: WorkspaceServiceClient;
    @inject(IDEPluginServiceClient) private readonly idePluginServiceClient: IDEPluginServiceClient;

    public async deleteUserContent(ownerId: string): Promise<void> {
        const request = new DeleteUserContentRequest();
        request.setOwnerId(ownerId);

        await new Promise<DeleteUserContentResponse>((resolve, reject) => {
            this.contentServiceClient.deleteUserContent(request, (err: any, resp: DeleteUserContentResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
    }

    public async deleteWorkspaceBackups(ownerId: string, workspaceId: string, includeSnapshots: boolean): Promise<void> {
        const request = new DeleteWorkspaceRequest();
        request.setOwnerId(ownerId);
        request.setWorkspaceId(workspaceId);
        request.setIncludeSnapshots(includeSnapshots);

        await new Promise<DeleteWorkspaceResponse>((resolve, reject) => {
            this.workspaceServiceClient.deleteWorkspace(request, (err: any, resp: DeleteWorkspaceResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
    }

    public async createWorkspaceContentDownloadUrl(ownerId: string, workspaceId: string): Promise<string> {
        const request = new WorkspaceDownloadURLRequest();
        request.setOwnerId(ownerId);
        request.setWorkspaceId(workspaceId);

        const response = await new Promise<WorkspaceDownloadURLResponse>((resolve, reject) => {
            this.workspaceServiceClient.workspaceDownloadURL(request, (err: any, resp: WorkspaceDownloadURLResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(resp);
                }
            });
        });
        return response.toObject().url;
    }

    public async createPluginUploadUrl(bucket: string, objectPath: string): Promise<string> {
        const request = new PluginUploadURLRequest();
        request.setBucket(bucket);
        request.setName(objectPath);

        const response = await new Promise<PluginUploadURLResponse>((resolve, reject) => {
            this.idePluginServiceClient.uploadURL(request, (err: any, resp: PluginUploadURLResponse) => {
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
            this.idePluginServiceClient.downloadURL(request, (err: any, resp: PluginDownloadURLResponse) => {
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
            this.idePluginServiceClient.pluginHash(request, (err: any, resp: PluginHashResponse) => {
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
            this.workspaceServiceClient.workspaceSnapshotExists(request, (err: any, resp: WorkspaceSnapshotExistsResponse) => {
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
