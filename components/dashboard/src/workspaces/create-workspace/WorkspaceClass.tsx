/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useMemo } from "react";
import { useWorkspaceClasses } from "../../data/workspaces/workspace-classes-query";
import ContextMenu, { ContextMenuEntry } from "../../components/ContextMenu";

type WorkspaceClassProps = {
    selectedWSClassID: string;
    onChange: (workspaceClass: string) => void;
};
export const WorkspaceClass: FC<WorkspaceClassProps> = ({ selectedWSClassID, onChange }) => {
    const { data: workspaceClasses, isLoading } = useWorkspaceClasses();

    const menuEntries = useMemo((): ContextMenuEntry[] => {
        return (workspaceClasses || [])?.map((c) => ({
            title: c.displayName,
            onClick: () => {
                onChange(c.id);
            },
        }));
    }, [workspaceClasses, onChange]);

    const selectedWSClass = useMemo(() => {
        if (!workspaceClasses) {
            return;
        }
        const defaultClassID = workspaceClasses.find((ws) => ws.isDefault)?.id;

        return workspaceClasses.find((ws) => ws.id === (selectedWSClassID || defaultClassID));
    }, [selectedWSClassID, workspaceClasses]);

    if (isLoading) {
        return <span>...</span>;
    }

    return (
        <ContextMenu menuEntries={menuEntries}>
            <span>{selectedWSClass?.description ?? "unknown"}</span>
        </ContextMenu>
    );
};
