/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { RepositoryService } from "../../../src/repohost/repo-service";
import { inject, injectable } from "inversify";
import { GiteaRestApi } from "../../../src/gitea/api";

@injectable()
export class GiteaService extends RepositoryService {
    @inject(GiteaRestApi) protected readonly giteaApi: GiteaRestApi;
    // TODO: complete?
}