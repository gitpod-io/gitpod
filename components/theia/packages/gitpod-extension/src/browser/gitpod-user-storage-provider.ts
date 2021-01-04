/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { GitpodInfoService } from "../common/gitpod-info";
import URI from "@theia/core/lib/common/uri";
import { Emitter, Event, Disposable } from "@theia/core";
import { FileWriteOptions, FileSystemProviderCapabilities, FileChange, WatchOptions, Stat, FileType, FileDeleteOptions, FileOverwriteOptions, FileSystemProviderWithFileReadWriteCapability, FileChangeType, FileSystemProviderErrorCode, createFileSystemProviderError } from "@theia/filesystem/lib/common/files";
import { EncodingService } from "@theia/core/lib/common/encoding-service";
import { BinaryBuffer } from "@theia/core/lib/common/buffer";
import { UserStorageUri } from "@theia/userstorage/lib/browser/user-storage-uri";
import { CachedUserStorage } from "./gitpod-user-storage-cached";

@injectable()
export class GitpodUserStorageProvider implements FileSystemProviderWithFileReadWriteCapability {

    @inject(GitpodInfoService) protected infoProvider: GitpodInfoService;
    @inject(CachedUserStorage) protected cachedUserStorage: CachedUserStorage;
    @inject(EncodingService) protected readonly encodingService: EncodingService;

    protected readonly onDidChangeFileEmitter = new Emitter<readonly FileChange[]>();
    readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

    readonly capabilities = FileSystemProviderCapabilities.FileReadWrite;
    readonly onDidChangeCapabilities = Event.None;

    // TODO server could provide stats instead
    protected readonly stats = new Map<string, Stat>();
    protected updateStat(resource: URI, value: Uint8Array, modified: boolean): void {
        const existing = this.stats.get(resource.toString());
        const mtime = modified || !existing ? performance.now() : existing.mtime;
        const ctime = existing && existing.ctime || mtime;
        this.stats.set(resource.toString(), {
            type: FileType.File,
            mtime, ctime, size: value.length
        });
    }

    /**
     * For backward compatibility transfrom proper absolute URIs to bogusly relative.
     */
    protected toBackwardCompatibleUri(resource: URI): string {
        const relativePath = UserStorageUri.relative(resource);
        if (!relativePath) {
            throw new Error('invalid resource: ' + resource.toString());
        }
        return resource.withPath(relativePath).toString();
    }

    async stat(resource: URI): Promise<Stat> {
        let stat = this.stats.get(resource.toString());
        if (!stat) {
            await this.readFile(resource);
            stat = this.stats.get(resource.toString());
        }
        if (!stat) {
            throw createFileSystemProviderError('File does not exist', FileSystemProviderErrorCode.FileNotFound);
        }
        return stat;
    }

    async readFile(resource: URI): Promise<Uint8Array> {
        // TODO server could resolve binary instead
        const uri = this.toBackwardCompatibleUri(resource);
        const content = await this.cachedUserStorage.read({ uri });
        const value = this.encodingService.encode(content).buffer;
        this.updateStat(resource, value, false);
        return value;
    }

    async writeFile(resource: URI, value: Uint8Array, opts: FileWriteOptions): Promise<void> {
        const content = this.encodingService.decode(BinaryBuffer.wrap(value));
        // TODO server could accept binary instead
        const uri = this.toBackwardCompatibleUri(resource);
        await this.cachedUserStorage.write({ uri, content });
        this.updateStat(resource, value, true);
        // TODO server could fire a notification that some resournce was changed instead
        this.onDidChangeFileEmitter.fire([{
            type: FileChangeType.UPDATED,
            resource
        }]);
    }

    watch(resource: URI, opts: WatchOptions): Disposable {
        return Disposable.NULL;
    }

    mkdir(resource: URI): Promise<void> {
        return Promise.resolve();
    }

    readdir(resource: URI): Promise<[string, FileType][]> {
        return Promise.resolve([]);
    }

    delete(resource: URI, opts: FileDeleteOptions): Promise<void> {
        return Promise.resolve();
    }

    rename(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void> {
        return Promise.resolve();
    }

}
