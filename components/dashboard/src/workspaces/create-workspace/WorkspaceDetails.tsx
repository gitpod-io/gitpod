/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { WorkspaceClass } from "./WorkspaceClass";
import { WorkspaceIDE } from "./WorkspaceIDE";

type Props = {
    selectedIDE: string;
    useLatestIDE: boolean;
    selectedWSClassID: string;
    onWSClassChange: (workspaceClass: string) => void;
    onIDEChange: (ide: string, useLatest: boolean) => void;
};
export const WorkspaceDetails: FC<Props> = ({
    selectedIDE,
    useLatestIDE,
    selectedWSClassID,
    onWSClassChange,
    onIDEChange,
}) => {
    return (
        <div className="flex flex-row justify-start items-center gap-2 mt-4 mx-2">
            <WorkspaceClass selectedWSClassID={selectedWSClassID} onChange={onWSClassChange} />
            <span>with</span>
            <WorkspaceIDE selectedIDE={selectedIDE} useLatestIDE={useLatestIDE} onChange={onIDEChange} />
        </div>
    );
};
