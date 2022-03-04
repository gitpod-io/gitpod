/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { ImageBuilderClientProvider, ResolveBaseImageRequest, BuildRegistryAuthTotal, BuildRegistryAuth } from "@gitpod/image-builder/lib";
import { HostContextProvider } from "../auth/host-context-provider";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { CommitContext, WorkspaceImageSource, WorkspaceConfig, WorkspaceImageSourceReference, WorkspaceImageSourceDocker, ImageConfigFile, ExternalImageConfigFile, User, AdditionalContentContext } from "@gitpod/gitpod-protocol";
import { createHash } from 'crypto';

@injectable()
export class ImageSourceProvider {
    @inject(ImageBuilderClientProvider) protected readonly imagebuilderClientProvider: ImageBuilderClientProvider;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;

    public async getImageSource(ctx: TraceContext, user: User, context: CommitContext, config: WorkspaceConfig): Promise<WorkspaceImageSource> {
        const span = TraceContext.startSpan("getImageSource", ctx);

        try {
            let result: WorkspaceImageSource;

            const imgcfg = config.image;
            if (ExternalImageConfigFile.is(imgcfg)) {
                // we're asked to pull the Dockerfile from a repo possibly different than the one we're opening a workspace for (e.g. definitely-gp).
                const repository = imgcfg.externalSource.repository;
                const hostContext = this.hostContextProvider.get(repository.host);
                if (!hostContext || !hostContext.services) {
                    throw new Error(`Cannot fetch workspace image source for host: ${repository.host}`);
                }
                const lastDockerFileSha = await hostContext.services.fileProvider.getLastChangeRevision(repository, imgcfg.externalSource.revision, user, imgcfg.file);
                result = <WorkspaceImageSourceDocker>{
                    dockerFilePath: imgcfg.file,
                    dockerFileSource: imgcfg.externalSource,
                    dockerFileHash: lastDockerFileSha
                }
            } else if (ImageConfigFile.is(imgcfg)) {
                // if a dockerfile sits in the additional content we use its contents sha
                if (AdditionalContentContext.is(context) && ImageConfigFile.is(config.image) && context.additionalFiles[config.image.file]) {
                    return {
                        dockerFilePath: config.image.file,
                        dockerFileHash: this.getContentSHA(context.additionalFiles[config.image.file]),
                        dockerFileSource: CommitContext.is(context) ? context : undefined
                    }
                }
                // There are no special instructions as to where to get the Dockerfile from, hence we use the context of the current workspace.
                const hostContext = this.hostContextProvider.get(context.repository.host);
                if (!hostContext || !hostContext.services) {
                    throw new Error(`Cannot fetch workspace image source for host: ${context.repository.host}`);
                }
                const lastDockerFileSha = await hostContext.services.fileProvider.getLastChangeRevision(context.repository, context.revision, user, imgcfg.file);
                result = <WorkspaceImageSourceDocker>{
                    dockerFilePath: imgcfg.file,
                    dockerFileSource: context,
                    dockerFileHash: lastDockerFileSha,
                }
            } else if (typeof (imgcfg) === "string") {
                // We resolve this request allowing all configured auth because at this poing we don't have access to the user or permission service.
                // If anyone feels like changing this and properly use the REGISTRY_ACCESS permission, be my guest.
                //
                // This might leak a tiny bit of information in that the workspace start failes
                // differently if the image is present as compared to when it's not. This way users can find out if an image exists even if they don't
                // have access to the registry themselves.
                //
                // If feel this issue is negligeble.
                const req = new ResolveBaseImageRequest();
                req.setRef(imgcfg);
                const allowAll = new BuildRegistryAuthTotal();
                allowAll.setAllowAll(true);
                const auth = new BuildRegistryAuth();
                auth.setTotal(allowAll);
                req.setAuth(auth);

                const client = this.imagebuilderClientProvider.getDefault();
                const res = await client.resolveBaseImage({ span }, req);

                result = <WorkspaceImageSourceReference>{
                    baseImageResolved: res.getRef()
                }
            } else {
                throw new Error("unknown workspace image source config");
            }

            return result;
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    protected getContentSHA(contents: string): string {
        return createHash('sha256').update(contents).digest('hex');
    }


}