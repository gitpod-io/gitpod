/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, postConstruct } from "inversify";
import { CommitContext, User, WorkspaceConfig } from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "../auth/host-context-provider";
import { Config } from "../config";

export type LanguageConfigProvider = (language: string, user: User, commit: CommitContext) => Promise<WorkspaceConfig | undefined>;

@injectable()
export class ConfigInferenceProvider {
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(Config) protected readonly config: Config;

    protected readonly languageConfigProvider = new Map<string, LanguageConfigProvider>();

    @postConstruct()
    public registerLanguageInferrer() {
        this.languageConfigProvider.set('Go', this.computeGoConfig.bind(this));
    }

    public async infer(user: User, commit: CommitContext): Promise<WorkspaceConfig | undefined> {
        const host = commit.repository.host;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext || !hostContext.services) {
            return undefined;
        }
        const repoHost = hostContext.services;
        const languages = await repoHost.languagesProvider.getLanguages(commit.repository, user);
        const topLanguage = this.findTopLanguage(languages);
        if (topLanguage === undefined) {
            return undefined;
        }

        const configProvider = this.languageConfigProvider.get(topLanguage);
        if (configProvider === undefined) {
            return undefined;
        }

        return configProvider(topLanguage, user, commit);
    }

    protected findTopLanguage(languages: any) {
        let result: string | undefined;
        let topScore: number | undefined;
        Object.keys(languages).forEach(lang => {
            let score = languages[lang];
            if (topScore === undefined || score > topScore) {
                result = lang;
                topScore = score;
            }
        });
        return result;
    }

    protected async computeGoConfig(lang: String, user: User, commit: CommitContext): Promise<WorkspaceConfig | undefined> {
        return {
            ports: [],
            tasks: [
                {
                    init: `test -f go.mod && go get -v ./...`
                }
            ],
            image: this.config.workspaceDefaults.workspaceImage,
        } as WorkspaceConfig;
    }

}