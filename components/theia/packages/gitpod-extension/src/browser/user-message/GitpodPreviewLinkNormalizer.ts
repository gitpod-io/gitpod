/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import { PreviewLinkNormalizer } from "@theia/preview/lib/browser/preview-link-normalizer";
import URI from "@theia/core/lib/common/uri";
import { MiniBrowserEnvironment } from '../mini-browser/mini-browser-environment';

@injectable()
export class GitpodPreviewLinkNormalizer extends PreviewLinkNormalizer {

    @inject(MiniBrowserEnvironment)
    private readonly miniBrowserEnvironment: MiniBrowserEnvironment;

    normalizeLink(documentUri: URI, link: string): string {
        try {
            if (documentUri.scheme !== 'file') {
                return documentUri.parent.resolve(link).toString();
            }
            if (!this.urlScheme.test(link)) {
                const location = documentUri.parent.resolve(link).path.toString();
                return this.miniBrowserEnvironment.getEndpoint('normalized-link').getRestUrl().resolve(location).toString();
            }
        } catch {
            // ignore
        }
        return link;
    }
}