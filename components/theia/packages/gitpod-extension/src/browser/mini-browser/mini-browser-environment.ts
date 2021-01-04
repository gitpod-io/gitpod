/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { Endpoint, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { inject, injectable, postConstruct } from 'inversify';
import { MiniBrowserEndpoint } from '../../common/mini-browser-endpoint';
import { v4 } from 'uuid';

/**
 * Fetch values from the backend's environment.
 */
@injectable()
export class MiniBrowserEnvironment implements FrontendApplicationContribution {

    protected _hostPatternPromise: Promise<string>;
    protected _hostPattern: string;

    @inject(EnvVariablesServer)
    protected readonly environment: EnvVariablesServer;

    @postConstruct()
    protected postConstruct(): void {
        this._hostPatternPromise = this.environment.getValue(MiniBrowserEndpoint.HOST_PATTERN_ENV)
            .then(envVar => envVar?.value || MiniBrowserEndpoint.HOST_PATTERN_DEFAULT);
    }

    async onStart(): Promise<void> {
        this._hostPattern = await this._hostPatternPromise;
    }

    getEndpoint(uuid: string, hostname?: string): Endpoint {
        return new Endpoint({
            host: this._hostPattern
                .replace('{{uuid}}', uuid)
                .replace('{{hostname}}', hostname || this.getDefaultHostname()),
        });
    }

    getRandomEndpoint(): Endpoint {
        return this.getEndpoint(v4());
    }

    protected getDefaultHostname(): string {
        return self.location.host;
    }
}
