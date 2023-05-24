/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";
import { useCallback, useEffect, useMemo } from "react";
import WorkspaceClass from "../icons/WorkspaceClass.svg";
import { DropDown2, DropDown2Element } from "./DropDown2";
import { useWorkspaceClasses } from "../data/workspaces/workspace-classes-query";

interface SelectWorkspaceClassProps {
    selectedWorkspaceClass?: string;
    onSelectionChange: (workspaceClass: string) => void;
    setError?: (error?: string) => void;
    disabled?: boolean;
}

export default function SelectWorkspaceClassComponent(props: SelectWorkspaceClassProps) {
    const workspaceClasses = useWorkspaceClasses();
    const elements = useMemo(() => {
        if (!workspaceClasses.data) {
            return [];
        }
        return [
            ...workspaceClasses.data?.map(
                (c) =>
                    ({
                        id: c.id,
                        element: <WorkspaceClassDropDownElement wsClass={c} />,
                        isSelectable: true,
                    } as DropDown2Element),
            ),
        ];
    }, [workspaceClasses.data]);
    useEffect(() => {
        if (!workspaceClasses.data) {
            return;
        }
        // if the selected workspace class is not supported, we set an error and ask the user to pick one
        if (
            props.selectedWorkspaceClass &&
            !workspaceClasses.data?.find((c) => c.id === props.selectedWorkspaceClass)
        ) {
            props.setError?.(`The workspace class '${props.selectedWorkspaceClass}' is not supported.`);
        }
    }, [workspaceClasses.data, props.selectedWorkspaceClass, props.setError, props]);
    const internalOnSelectionChange = useCallback(
        (id: string) => {
            props.onSelectionChange(id);
            if (props.setError) {
                props.setError(undefined);
            }
        },
        [props],
    );
    const selectedWsClass = useMemo(() => {
        if (!workspaceClasses.data) {
            return undefined;
        }
        const defaultClassId = workspaceClasses.data.find((ws) => ws.isDefault)?.id;
        return workspaceClasses.data.find((ws) => ws.id === (props.selectedWorkspaceClass || defaultClassId));
    }, [props.selectedWorkspaceClass, workspaceClasses.data]);
    return (
        <DropDown2
            getElements={() => elements}
            onSelectionChange={internalOnSelectionChange}
            searchPlaceholder="Select class"
            disableSearch={true}
            allOptions={selectedWsClass?.id}
            disabled={props.disabled}
        >
            <WorkspaceClassDropDownElementSelected wsClass={selectedWsClass} />
        </DropDown2>
    );
}

function WorkspaceClassDropDownElementSelected(props: { wsClass?: SupportedWorkspaceClass }): JSX.Element {
    const c = props.wsClass;
    let title = "Select class";
    if (c) {
        title = c.displayName;
    }
    return (
        <div className="flex h-12" title={title}>
            <div className="mx-2 my-2">
                <img className="w-8 filter-grayscale self-center" src={WorkspaceClass} alt="logo" />
            </div>
            <div className="flex-col ml-1 mt-1 flex-grow">
                <div className="text-gray-700 dark:text-gray-300 font-semibold truncate w-80">{title}</div>
                <div className="flex text-xs text-gray-500 dark:text-gray-400">
                    <div className="font-semibold">
                        Class <span className="text-gray-300 dark:text-gray-600 font-normal">&middot;</span>{" "}
                        <span className="text-gray-500 dark:text-gray-400 font-normal">{c?.description}</span>
                    </div>
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
