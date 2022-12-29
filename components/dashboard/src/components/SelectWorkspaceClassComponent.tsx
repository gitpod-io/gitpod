/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";
import { useEffect, useMemo, useState } from "react";
import { getGitpodService } from "../service/service";
import WorkspaceClass from "../icons/WorkspaceClass.svg";
import { DropDown2, DropDown2Element } from "./DropDown2";

interface SelectWorkspaceClassProps {
    selectedWorkspaceClass?: string;
    onSelectionChange: (workspaceClass: string) => void;
}

export default function SelectWorkspaceClassComponent(props: SelectWorkspaceClassProps) {
    const [workspaceClasses, setWorkspaceClasses] = useState<SupportedWorkspaceClass[]>();
    useEffect(() => {
        getGitpodService().server.getSupportedWorkspaceClasses().then(setWorkspaceClasses);
    }, []);
    const getElements = useMemo(() => {
        return () => {
            if (!workspaceClasses) {
                return [];
            }
            return [
                ...workspaceClasses.map(
                    (c) =>
                        ({
                            id: c.id,
                            element: <WorkspaceClassDropDownElement wsClass={c} />,
                            isSelectable: true,
                        } as DropDown2Element),
                ),
            ];
        };
    }, [workspaceClasses]);
    return (
        <DropDown2
            getElements={getElements}
            onSelectionChange={props.onSelectionChange}
            searchPlaceholder="Select class"
            disableSearch={true}
        >
            <WorkspaceClassDropDownElementSelected
                wsClass={workspaceClasses?.find(
                    (ws) => ws.id === (props.selectedWorkspaceClass || workspaceClasses.find((ws) => ws.isDefault)?.id),
                )}
            />
        </DropDown2>
    );
}

function WorkspaceClassDropDownElementSelected(props: { wsClass?: SupportedWorkspaceClass }): JSX.Element {
    const c = props.wsClass;
    return (
        <div className="flex h-12" title={c?.displayName}>
            <div className="mx-2 my-2">
                <img className="w-8 filter-grayscale self-center" src={WorkspaceClass} alt="logo" />
            </div>
            <div className="flex-col ml-1 mt-1 flex-grow">
                <div className="text-gray-700 dark:text-gray-300 font-semibold">Class</div>
                <div className="flex text-xs text-gray-500 dark:text-gray-400">
                    <div className="font-semibold">{c?.displayName}</div>
                    <div className="mx-1">&middot;</div>
                    <div>{c?.description}</div>
                </div>
            </div>
        </div>
    );
}

function WorkspaceClassDropDownElement(props: { wsClass: SupportedWorkspaceClass }): JSX.Element {
    const c = props.wsClass;
    return (
        <div className="flex ml-1 mt-1 flex-grow">
            <div className="text-gray-700 dark:text-gray-300 font-semibold">{c.displayName}</div>
            <div className="mx-1 text-gray-500">&middot;</div>
            <div className="flex text-gray-500">
                <div>{c?.description}</div>
            </div>
        </div>
    );
}
