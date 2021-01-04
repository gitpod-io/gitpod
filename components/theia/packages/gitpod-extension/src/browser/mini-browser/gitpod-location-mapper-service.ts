/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MaybePromise } from '@theia/core/lib/common/types';
import URI from '@theia/core/lib/common/uri';
import { LocationMapper, LocationMapperService, FileLocationMapper as InsecureFileLocationMapper } from '@theia/mini-browser/lib/browser/location-mapper-service';
import { inject, injectable } from 'inversify';
import { MiniBrowserEnvironment } from './mini-browser-environment';

@injectable()
export class GitpodLocationMapperService extends LocationMapperService {

    protected getContributions(): LocationMapper[] {
        return this.contributions.getContributions().filter(c => !(c instanceof InsecureFileLocationMapper));
    }

}

@injectable()
export class SecureFileLocationMapper implements LocationMapper {

    @inject(MiniBrowserEnvironment)
    protected readonly miniBrowserEnvironment: MiniBrowserEnvironment;

    canHandle(location: string): MaybePromise<number> {
        return location.startsWith('file://') ? 1 : 0;
    }

    map(location: string): MaybePromise<string> {
        const uri = new URI(location);
        if (uri.scheme !== 'file') {
            throw new Error(`Only URIs with 'file' scheme can be mapped to an URL. URI was: ${uri}.`);
        }
        let rawLocation = uri.path.toString();
        if (rawLocation.charAt(0) === '/') {
            rawLocation = rawLocation.substr(1);
        }
        return this.miniBrowserEnvironment.getRandomEndpoint().getRestUrl().resolve(rawLocation).toString();
    }

}
