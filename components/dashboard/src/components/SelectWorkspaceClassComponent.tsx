/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo } from "react";
import WorkspaceClassIcon from "../icons/WorkspaceClass.svg";
import { Combobox, ComboboxElement, ComboboxSelectedItem } from "./podkit/combobox/Combobox";
import { WorkspaceClass } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { useAllowedWorkspaceClassesMemo } from "../data/workspaces/workspace-classes-query";
import { PlainMessage } from "@bufbuild/protobuf";
import { Link } from "react-router-dom";
import { repositoriesRoutes } from "../repositories/repositories.routes";
import { useFeatureFlag } from "../data/featureflag-query";

interface SelectWorkspaceClassProps {
    selectedConfigurationId?: string;
    selectedWorkspaceClass?: string;
    onSelectionChange: (workspaceClass: string) => void;
    setError?: (error?: React.ReactNode) => void;
    disabled?: boolean;
    loading?: boolean;
}

export default function SelectWorkspaceClassComponent({
    selectedConfigurationId,
    selectedWorkspaceClass,
    disabled,
    loading,
    setError,
    onSelectionChange,
}: SelectWorkspaceClassProps) {
    const enabledWorkspaceClassRestrictionOnConfiguration = useFeatureFlag(
        "configuration_workspace_class_restrictions",
    );
    const { data: workspaceClasses, isLoading: workspaceClassesLoading } = useAllowedWorkspaceClassesMemo(
        selectedConfigurationId,
        {
            filterOutDisabled: true,
        },
    );

    const getElements = useCallback((): ComboboxElement[] => {
        return (workspaceClasses || [])?.map((c) => ({
            id: c.id,
            element: <WorkspaceClassDropDownElement wsClass={c} />,
            isSelectable: true,
        }));
    }, [workspaceClasses]);

    useEffect(() => {
        if (!workspaceClasses || loading || disabled || workspaceClassesLoading) {
            return;
        }

        if (workspaceClasses.length === 0) {
            const repoWorkspaceSettingsLink =
                selectedConfigurationId && repositoriesRoutes.WorkspaceSettings(selectedConfigurationId);
            const teamSettingsLink = "/settings";
            setError?.(
                <>
                    No allowed workspace classes available. Please contact an admin to update{" "}
                    <Link className="underline" to={teamSettingsLink}>
                        organization settings
                    </Link>
                    {enabledWorkspaceClassRestrictionOnConfiguration && repoWorkspaceSettingsLink && (
                        <>
                            {" or "}
                            <Link className="underline" to={repoWorkspaceSettingsLink}>
                                configuration settings
                            </Link>
                        </>
                    )}
                    .
                </>,
            );
            return;
        }
        setError?.(undefined);
    }, [
        loading,
        workspaceClassesLoading,
        disabled,
        workspaceClasses,
        selectedWorkspaceClass,
        setError,
        enabledWorkspaceClassRestrictionOnConfiguration,
        selectedConfigurationId,
    ]);
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
        // first we try to find the selected class, then the computed default, then the global default and finally the first one
        const selectedWsClass = workspaceClasses.find((ws) => ws.id === selectedWorkspaceClass);
        if (selectedWsClass) {
            return selectedWsClass;
        }
        const computedDefaultClass = workspaceClasses.find((ws) => ws.isComputedDefaultClass);
        if (computedDefaultClass) {
            return computedDefaultClass;
        }
        const defaultClass = workspaceClasses.find((ws) => ws.isDefault);
        if (defaultClass) {
            return defaultClass;
        }
        return workspaceClasses[0];
    }, [selectedWorkspaceClass, workspaceClasses]);
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
    wsClass?: PlainMessage<WorkspaceClass>;
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

function WorkspaceClassDropDownElement(props: { wsClass: PlainMessage<WorkspaceClass> }): JSX.Element {
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
