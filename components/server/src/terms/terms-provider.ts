/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';
import { Terms } from '@gitpod/gitpod-protocol';

@injectable()
export class TermsProvider {
    getCurrent(): Terms {
        return currentTerms;
    }
}

const currentTerms: Terms = {
    activeSince: "2020-11",
    adminOnlyTerms: true,
    revision: "2020-11",
    updateMessage: `
# Terms and Conditions Update

Read the updated [terms](https://www.gitpod.io/self-hosted-terms/).
`,
    content: `
# Create a new Gitpod account with {{AUTH_HOST}}

Before we proceed, please read and accept the [terms](https://www.gitpod.io/self-hosted-terms/).
`
}
