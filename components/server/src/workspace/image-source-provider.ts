/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { HostContextProvider } from "../auth/host-context-provider";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import {
    CommitContext,
    WorkspaceImageSource,
    WorkspaceConfig,
    WorkspaceImageSourceReference,
    WorkspaceImageSourceDocker,
    ImageConfigFile,
    User,
    AdditionalContentContext,
} from "@gitpod/gitpod-protocol";
import { createHash } from "crypto";

@injectable()
export class ImageSourceProvider {
    constructor(@inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider) {}

    public async getImageSource(
        ctx: TraceContext,
        user: User,
        context: CommitContext,
        config: WorkspaceConfig,
    ): Promise<WorkspaceImageSource> {
        const span = TraceContext.startSpan("getImageSource", ctx);

        try {
            let result: WorkspaceImageSource;

            const imgcfg = config.image;
            if (ImageConfigFile.is(imgcfg)) {
                // if a dockerfile sits in the additional content we use its contents sha
                if (
                    AdditionalContentContext.is(context) &&
                    ImageConfigFile.is(config.image) &&
                    context.additionalFiles[config.image.file]
                ) {
                    return {
                        dockerFilePath: config.image.file,
                        dockerFileHash: this.getContentSHA(context.additionalFiles[config.image.file]),
                        dockerFileSource: CommitContext.is(context) ? context : undefined,
                    };
                }
                // There are no special instructions as to where to get the Dockerfile from, hence we use the context of the current workspace.
                const hostContext = this.hostContextProvider.get(context.repository.host);
                if (!hostContext || !hostContext.services) {
                    throw new Error(`Cannot fetch workspace image source for host: ${context.repository.host}`);
                }
                const lastDockerFileSha = await hostContext.services.fileProvider.getLastChangeRevision(
                    context.repository,
                    context.revision,
                    user,
                    imgcfg.file,
                );
                result = <WorkspaceImageSourceDocker>{
                    dockerFilePath: imgcfg.file,
                    dockerFileSource: context,
                    dockerFileHash: lastDockerFileSha,
                };
            } else if (typeof imgcfg === "string") {
                result = <WorkspaceImageSourceReference>{
                    baseImageResolved: imgcfg,
                };
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

    private getContentSHA(contents: string): string {
        return createHash("sha256").update(contents).digest("hex");
    }
}
