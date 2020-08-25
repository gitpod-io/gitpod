/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';

import { renderEntrypoint } from "./entrypoint";

export class Blocked extends React.Component<{}, {}> {

	render() {
		return (
            <div className="blocked">
                <h1 className="heading">Your account has been blocked.</h1>
                <div className="text">If you have questions please <a href="mailto:support@gitpod.io?Subject=Blocked" target="_top">contact us</a>.</div>
            </div>
		);
	}
}
renderEntrypoint(Blocked);
