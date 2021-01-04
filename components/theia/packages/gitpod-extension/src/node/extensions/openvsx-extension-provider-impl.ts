/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { getExtension } from 'ovsx';
import { createTempFile } from 'ovsx/lib/util'
import { FileUri } from '@theia/core/lib/node';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';
import { OpenVSXExtensionProvider } from '../../common/openvsx-extension-provider';

@injectable()
export class OpenVSXExtensionProviderImpl implements OpenVSXExtensionProvider {

    @inject(VSXEnvironment)
    protected readonly environment: VSXEnvironment;

    async downloadExtension(extensionId: string, version?: string): Promise<string> {
        const registryUrl = await this.environment.getRegistryUri();
        const filePath = await createTempFile({ prefix: extensionId, postfix: '.vsix' });
        await getExtension({
            registryUrl: registryUrl.toString(),
            extensionId,
            version,
            output: filePath
        });
        return FileUri.create(filePath).toString();
    }

}
