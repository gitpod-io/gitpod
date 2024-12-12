/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspacePhase_Phase, WorkspaceSession } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { displayTime } from "./WorkspaceSessionGroup";

type Props = {
    session: WorkspaceSession;
};
export const WorkspaceSessionEntry = ({ session }: Props) => {
    const isRunning = session?.workspace?.status?.phase?.name === WorkspacePhase_Phase.RUNNING;

    return (
        <li className="text-sm text-gray-600 dark:text-gray-300">
            {session.creationTime ? displayTime(session.creationTime) : "n/a"} (
            {session.id.slice(0, 7) || "No instance ID"}){isRunning ? " - running" : ""}
        </li>
    );
};
