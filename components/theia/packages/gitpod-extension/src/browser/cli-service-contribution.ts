/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CliServiceClient } from './cli-service-client';

@injectable()
export class CliServiceContribution implements FrontendApplicationContribution {

    @inject(CliServiceClient) protected readonly tokenServiceClient: CliServiceClient;

    onStart(app: FrontendApplication) {
        // just need a dependent for CliServiceClient
    }

}
