/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// generated using github.com/32leaves/bel on 2020-08-19 06:25:22.10083888 +0000 UTC m=+0.001964099
// DO NOT MODIFY
// re-generate using `cd devops/images/workspace-image-builder/gitpod-cli && go generate ./...`
export const TheiaCLIService = Symbol('TheiaCLIService');
export const SERVICE_PATH = '/services/cli';

export interface DeleteEnvvarRequest {
    variables: string[]
}

export interface DeleteEnvvarResponse {
    deleted: string[]
    notDeleted: string[]
}

export interface EnvironmentVariable {
    name: string
    value: string
}

export interface GetEnvvarsRequest {
}

export interface GetEnvvarsResponse {
    variables: EnvironmentVariable[]
}

export interface GetGitTokenRequest {
    gitCommand?: string
    host: string
    repoURL?: string
}

export interface GetGitTokenResponse {
    token: string
    user: string
}

export interface GetPortURLRequest {
    port: number
}

export interface GetPortURLResponse {
    url: string
}

export interface IsFileOpenRequest {
    path: string
}

export interface IsFileOpenResponse {
    isOpen: boolean
}

export interface OpenFileRequest {
    path: string
}

export interface OpenFileResponse {
}

export interface OpenPreviewRequest {
    url: string
}

export interface OpenPreviewResponse {
}

export interface SetEnvvarRequest {
    variables: EnvironmentVariable[]
}

export interface SetEnvvarResponse {
}

export interface TheiaCLIService {
    deleteEnvVar(arg0: DeleteEnvvarRequest): Promise<DeleteEnvvarResponse>
    getEnvVars(arg0: GetEnvvarsRequest): Promise<GetEnvvarsResponse>
    getGitToken(arg0: GetGitTokenRequest): Promise<GetGitTokenResponse>
    getPortURL(arg0: GetPortURLRequest): Promise<GetPortURLResponse>
    isFileOpen(arg0: IsFileOpenRequest): Promise<IsFileOpenResponse>
    openFile(arg0: OpenFileRequest): Promise<OpenFileResponse>
    openPreview(arg0: OpenPreviewRequest): Promise<OpenPreviewResponse>
    setEnvVar(arg0: SetEnvvarRequest): Promise<SetEnvvarResponse>
}

