/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { getSubscriptionsUrl } from '../routing';

export namespace ShowNoPrivateReposUpgrade {
    export interface Props {
    }
}

export class ShowNoPrivateReposUpgrade extends React.Component<ShowNoPrivateReposUpgrade.Props> {

    render() {
        return (
            <div className="sorry">
                <h1 className="heading">Your current plan does not include access to private repositories.</h1>
                <div className="text">
                    Every paid subscription includes access to private repositories. Head over to <a href={getSubscriptionsUrl()}>Subscriptions</a> for an upgrade!
                </div>
            </div>
        );
    }
}
