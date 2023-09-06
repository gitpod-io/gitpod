/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useMemo } from "react";
import ContextMenu, { ContextMenuEntry } from "../../components/ContextMenu";
import { useFilteredAndSortedIDEOptions } from "../../data/ide-options/ide-options-query";

type WorkspaceIDEProps = {
    selectedIDE: string;
    useLatestIDE: boolean;
    onChange: (ide: string, useLatest: boolean) => void;
};
export const WorkspaceIDE: FC<WorkspaceIDEProps> = ({ selectedIDE, useLatestIDE, onChange }) => {
    const { data: ideOptions, isLoading } = useFilteredAndSortedIDEOptions();

    const menuEntries = useMemo((): ContextMenuEntry[] => {
        return (ideOptions || []).map((ide) => ({
            title: ide.title,
            onClick: () => {
                onChange(ide.id, useLatestIDE);
            },
        }));
    }, [ideOptions, onChange, useLatestIDE]);

    const selectedOption = useMemo(() => {
        if (!ideOptions) {
            return;
        }

        return ideOptions.find((ide) => ide.id === selectedIDE);
    }, [ideOptions, selectedIDE]);

    if (isLoading) {
        return <span>...</span>;
    }

    return (
        <ContextMenu menuEntries={menuEntries}>
            <span>{selectedOption?.title ?? "unknown"}</span>
        </ContextMenu>
    );
};
