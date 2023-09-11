/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useMemo } from "react";
import { useWorkspaceClasses } from "../../data/workspaces/workspace-classes-query";
import ContextMenu, { ContextMenuEntry } from "../../components/ContextMenu";
import { Button } from "../../components/Button";
import WorkspaceClassIcon from "../../icons/WorkspaceClass.svg";
import Arrow from "../../components/Arrow";
import { WorkspaceClassDropDownElement } from "../../components/SelectWorkspaceClassComponent";

type WorkspaceClassProps = {
    selectedWSClassID: string;
    onChange: (workspaceClass: string) => void;
};
export const WorkspaceClass: FC<WorkspaceClassProps> = ({ selectedWSClassID, onChange }) => {
    const { data: workspaceClasses, isLoading } = useWorkspaceClasses();

    const menuEntries = useMemo((): ContextMenuEntry[] => {
        return (workspaceClasses || [])?.map((c) => ({
            title: c.displayName,
            customContent: <WorkspaceClassDropDownElement wsClass={c} />,
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
        <ContextMenu menuEntries={menuEntries} customClasses="left-0">
            <Button
                type="secondary"
                size="small"
                icon={<img className="w-8 filter-grayscale" src={WorkspaceClassIcon} alt="logo" />}
            >
                <span className="font-semibold text-gray-600">{selectedWSClass?.displayName ?? "unknown"}</span>
                {/* <div className="flex h-full pl-0 pr-1 py-1.5 text-gray-50">
                    <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z"
                            fill="#78716C"
                        />
                        <title>Toggle organization selection menu</title>
                    </svg>
                </div> */}
                <Arrow direction={"down"} />
                {/* <span className="text-gray-600">
                    <img className="w-4" src={CaretDownIcon} alt="logo" />
                </span> */}
            </Button>
            {/* <span className="font-semibold">{selectedWSClass?.displayName ?? "unknown"}</span> */}
        </ContextMenu>
    );
};
