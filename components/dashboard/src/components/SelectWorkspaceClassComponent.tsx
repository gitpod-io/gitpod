/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo } from "react";
import WorkspaceClassIcon from "../icons/WorkspaceClass.svg";
import { Combobox, ComboboxElement, ComboboxSelectedItem } from "./podkit/combobox/Combobox";
import { WorkspaceClass } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { useOrgWorkspaceClassesQuery } from "../data/organizations/org-workspace-classes-query";

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
    const { data: workspaceClasses, isLoading: workspaceClassesLoading } = useOrgWorkspaceClassesQuery();

    const getElements = useCallback((): ComboboxElement[] => {
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
        if (workspaceClasses.length === 0) {
            setError?.(
                "No allowed workspace classes available. Please contact an admin to update organization settings.",
            );
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
        const selectedOne = workspaceClasses.find((ws) => ws.id === (selectedWorkspaceClass || defaultClassId));
        if (selectedOne) {
            internalOnSelectionChange(selectedOne.id);
        }
        return selectedOne;
    }, [selectedWorkspaceClass, workspaceClasses, internalOnSelectionChange]);
    return (
        <Combobox
            getElements={getElements}
            onSelectionChange={internalOnSelectionChange}
            searchPlaceholder="Select class"
            disableSearch={true}
            initialValue={selectedWsClass?.id}
            disabled={workspaceClassesLoading || loading || disabled}
        >
            <WorkspaceClassDropDownElementSelected
                wsClass={selectedWsClass}
                loading={workspaceClassesLoading || loading}
            />
        </Combobox>
    );
}

type WorkspaceClassDropDownElementSelectedProps = {
    wsClass?: WorkspaceClass;
    loading?: boolean;
};

const WorkspaceClassDropDownElementSelected: FC<WorkspaceClassDropDownElementSelectedProps> = ({
    wsClass,
    loading = false,
}) => {
    const title = wsClass?.displayName ?? "Select class";

    return (
        <ComboboxSelectedItem
            icon={WorkspaceClassIcon}
            loading={loading}
            htmlTitle={title}
            title={<div className="truncate">{title}</div>}
            subtitle={
                <div className="font-semibold truncate">
                    Class <span className="text-gray-300 dark:text-gray-600 font-normal">&middot;</span>{" "}
                    <span className="text-gray-500 dark:text-gray-400 font-normal truncate">
                        {wsClass?.description ?? ""}
                    </span>
                </div>
            }
        />
    );
};

function WorkspaceClassDropDownElement(props: { wsClass: WorkspaceClass }): JSX.Element {
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
