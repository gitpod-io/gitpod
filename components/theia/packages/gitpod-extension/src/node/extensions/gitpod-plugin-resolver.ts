/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as os from "os";
import * as path from "path";
import * as fs from "fs-extra";
import * as filenamify from "filenamify";
import { injectable, inject } from "inversify";
import { PluginDeployerResolver, PluginDeployerResolverContext } from "@theia/plugin-ext/lib/common/plugin-protocol";
import { GitpodPluginLocator } from "./gitpod-plugin-locator";

@injectable()
export class GitpodPluginResolver implements PluginDeployerResolver {

    private readonly extensionsPath: string;

    @inject(GitpodPluginLocator)
    protected readonly locator: GitpodPluginLocator;

    constructor() {
        this.extensionsPath = path.resolve(os.tmpdir(), 'vscode-extensions');
        fs.ensureDirSync(this.extensionsPath);
    }

    accept(): boolean {
        return true;
    }

    async resolve(context: PluginDeployerResolverContext): Promise<void> {
        const fullPluginName = context.getOriginId().trim();
        const resolvedExtensionPath = path.join(this.extensionsPath, filenamify(fullPluginName));
        context.addPlugin(fullPluginName, resolvedExtensionPath);
    }

    find(fileUri: string): Promise<{ fullPluginName: string } | undefined> {
        return this.locator.find(fileUri, this.extensionsPath);
    }

}