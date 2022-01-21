/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable } from 'inversify';
import * as fs from 'fs';

import { AbstractComponentEnv, getEnvVar, filePathTelepresenceAware } from '@gitpod/gitpod-protocol/lib/env';
import { parseOptions } from './chargebee/chargebee-provider';

@injectable()
export class Config extends AbstractComponentEnv {
  readonly chargebeeProviderOptions = parseOptions(
    fs.readFileSync(filePathTelepresenceAware('/chargebee/providerOptions')).toString(),
  );

  readonly chargebeeWebhook = this.parseChargebeeWebhook();
  protected parseChargebeeWebhook(): ChargebeeWebhook {
    const envVar = getEnvVar('CHARGEBEE_WEBHOOK');
    const obj = JSON.parse(envVar) as ChargebeeWebhook;
    if (!('user' in obj && 'password' in obj)) {
      throw new Error('Unable to parse chargebee webhook config from string: ' + envVar);
    }
    return obj;
  }

  /*
export GITPOD_GITHUB_APP_ENABLED=true
export GITPOD_GITHUB_APP_ID=22157
export GITPOD_GITHUB_APP_WEBHOOK_SECRET=foobar
export GITPOD_GITHUB_APP_CERT_PATH=/workspace/gitpod/charts/gitpod_io/secrets/gitpod-draft-development-app.2019-03-12.private-key.pem
export GITPOD_GITHUB_APP_MKT_NAME=gitpod-draft-development-app
    */
  readonly githubAppEnabled: boolean = process.env.GITPOD_GITHUB_APP_ENABLED == 'true';
  readonly githubAppAppID: number = process.env.GITPOD_GITHUB_APP_ID ? parseInt(process.env.GITPOD_GITHUB_APP_ID) : 0;
  readonly githubAppWebhookSecret: string = process.env.GITPOD_GITHUB_APP_WEBHOOK_SECRET || 'unknown';
  readonly githubAppCertPath: string = process.env.GITPOD_GITHUB_APP_CERT_PATH || 'unknown';

  readonly maxTeamSlotsOnCreation: number = !!process.env.TS_MAX_SLOTS_ON_CREATION
    ? parseInt(process.env.TS_MAX_SLOTS_ON_CREATION)
    : 1000;
}

export interface ChargebeeWebhook {
  user: string;
  password: string;
}
