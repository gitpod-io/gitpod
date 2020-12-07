/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';
import { createGitpodService } from "./service-factory";
import { TermsOfService } from "./components/tos/terms-of-service";
import { renderEntrypoint } from "./entrypoint";

const service = createGitpodService();
const terms = service.server.getTerms();

export class TosIndex extends React.Component {
    render() {
        return (
            <TermsOfService terms={terms} />
        );
    }
}

renderEntrypoint(TosIndex);
