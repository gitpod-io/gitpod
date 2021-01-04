/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { ExternalUriService } from '@theia/core/lib/browser/external-uri-service';
import URI from '@theia/core/lib/common/uri';
import { GitpodPortsService } from './ports/gitpod-ports-service';
import { parseLocalhost } from './gitpod-parse-localhost';
import { MaybePromise } from '@theia/core/lib/common/types';

@injectable()
export class GitpodExternalUriService extends ExternalUriService {
    @inject(GitpodPortsService) protected readonly portsService: GitpodPortsService;

    resolve(uri: URI): MaybePromise<URI> {
        const localhost = this.parseLocalhost(uri);
        if (!localhost) {
            return uri;
        }
        const maybePublicUrl = this.portsService.exposePort({
            port: localhost.port
        });
        if (typeof maybePublicUrl === "string") {
            return new URI(maybePublicUrl);
        }
        return maybePublicUrl.then(publicUrl => new URI(publicUrl));
    }

    protected toRemoteHost(localhost: { address: string, port: number }): string {
        return `${localhost.port}-${window.location.hostname}`;
    }

    parseLocalhost(uri: URI): { address: string, port: number } | undefined {
        return parseLocalhost(uri);
    }

}