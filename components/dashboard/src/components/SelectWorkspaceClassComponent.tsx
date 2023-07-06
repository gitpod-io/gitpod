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
    loading?: boolean;
}

export default function SelectWorkspaceClassComponent({
    selectedWorkspaceClass,
    disabled,
    loading,
    setError,
    onSelectionChange,
}: SelectWorkspaceClassProps) {
    const { data: workspaceClasses, isLoading: workspaceClassesLoading } = useWorkspaceClasses();

    const getElements = useCallback((): DropDown2Element[] => {
        return (workspaceClasses || [])?.map((c) => ({
            id: c.id,
            element: <WorkspaceClassDropDownElement wsClass={c} />,
            isSelectable: true,
        }));
    }, [workspaceClasses]);

    useEffect(() => {
        if (!workspaceClasses) {
            return;
        }
        // if the selected workspace class is not supported, we set an error and ask the user to pick one
        if (selectedWorkspaceClass && !workspaceClasses?.find((c) => c.id === selectedWorkspaceClass)) {
            setError?.(`The workspace class '${selectedWorkspaceClass}' is not supported.`);
        }
    }, [workspaceClasses, selectedWorkspaceClass, setError]);
    const internalOnSelectionChange = useCallback(
        (id: string) => {
            onSelectionChange(id);
            if (setError) {
                setError(undefined);
            }
        },
        [onSelectionChange, setError],
    );
    const selectedWsClass = useMemo(() => {
        if (!workspaceClasses) {
            return undefined;
        }
        const defaultClassId = workspaceClasses.find((ws) => ws.isDefault)?.id;
        return workspaceClasses.find((ws) => ws.id === (selectedWorkspaceClass || defaultClassId));
    }, [selectedWorkspaceClass, workspaceClasses]);
    return (
        <DropDown2
            getElements={getElements}
            onSelectionChange={internalOnSelectionChange}
            searchPlaceholder="Select class"
            disableSearch={true}
            allOptions={selectedWsClass?.id}
            disabled={workspaceClassesLoading || loading || disabled}
            loading={workspaceClassesLoading || loading}
        >
            <WorkspaceClassDropDownElementSelected
                wsClass={selectedWsClass}
                iconOnly={workspaceClassesLoading || loading}
            />
        </DropDown2>
    );
}

function WorkspaceClassDropDownElementSelected(props: {
    iconOnly?: boolean;
    wsClass?: SupportedWorkspaceClass;
}): JSX.Element {
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
                {!props.iconOnly && (
                    <>
                        <div className="text-gray-700 dark:text-gray-300 font-semibold truncate w-80">{title}</div>
                        <div className="flex text-xs text-gray-500 dark:text-gray-400">
                            <div className="font-semibold">
                                Class <span className="text-gray-300 dark:text-gray-600 font-normal">&middot;</span>{" "}
                                <span className="text-gray-500 dark:text-gray-400 font-normal">{c?.description}</span>
                            </div>
                        </div>
                    </>
                )}
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
