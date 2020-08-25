/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { createGitpodService } from "../../service-factory";
import { StartWorkspaceProps } from "../start-workspace";

export function getWorkspaceId() {
	const wsId = window.location.hash;
	if (wsId) {
		return wsId.substr(1);
	}
	throw new Error();
}

export function startWorkspaceProps(): StartWorkspaceProps {
    return {
        service: createGitpodService(),
        workspaceId: getWorkspaceId(),
    };
}
