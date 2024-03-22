/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo } from "react";
import { Combobox, ComboboxElement, ComboboxSelectedItem } from "./podkit/combobox/Combobox";
import Editor from "../icons/Editor.svg";
import { AllowedWorkspaceEditor, useAllowedWorkspaceEditorsMemo } from "../data/ide-options/ide-options-query";
import { MiddleDot } from "./typography/MiddleDot";
import { DisableScope } from "../data/workspaces/workspace-classes-query";
import { Link } from "react-router-dom";
import { repositoriesRoutes } from "../repositories/repositories.routes";

interface SelectIDEComponentProps {
    selectedIdeOption?: string;
    selectedConfigurationId?: string;
    pinnedEditorVersions?: Map<string, string>;
    useLatest?: boolean;
    onSelectionChange: (ide: string, latest: boolean) => void;
    setError?: (error?: React.ReactNode) => void;
    disabled?: boolean;
    loading?: boolean;
    ignoreRestrictionScopes: DisableScope[] | undefined;
    availableOptions?: string[];
}

export default function SelectIDEComponent({
    selectedIdeOption,
    selectedConfigurationId,
    pinnedEditorVersions,
    useLatest,
    disabled = false,
    loading = false,
    setError,
    onSelectionChange,
    ignoreRestrictionScopes,
    availableOptions,
}: SelectIDEComponentProps) {
    const {
        data: ideOptions,
        isLoading: ideOptionsLoading,
        computedDefault,
    } = useAllowedWorkspaceEditorsMemo(selectedConfigurationId, {
        filterOutDisabled: true,
        ignoreScope: ignoreRestrictionScopes,
    });

    const options = ideOptions;

    const getElements = useCallback(
        (search: string) => {
            if (!options) {
                return [];
            }
            const result: ComboboxElement[] = [];
            for (const ide of options.filter((ide) =>
                `${ide.label}${ide.title}${ide.notes}${ide.id}`.toLowerCase().includes(search.toLowerCase()),
            )) {
                if (!useLatest) {
                    result.push({
                        id: ide.id,
                        element: (
                            <IdeOptionElementInDropDown
                                option={ide}
                                pinnedIdeVersion={pinnedEditorVersions?.get(ide.id)}
                                useLatest={false}
                            />
                        ),
                        isSelectable: true,
                    });
                } else if (ide.latestImage) {
                    result.push({
                        id: ide.id + "-latest",
                        element: <IdeOptionElementInDropDown option={ide} useLatest={true} />,
                        isSelectable: true,
                    });
                }
            }
            return result;
        },
        [options, useLatest, pinnedEditorVersions],
    );
    const internalOnSelectionChange = (id: string) => {
        const { ide, useLatest } = parseId(id);
        onSelectionChange(ide, useLatest);
        if (setError) {
            setError(undefined);
        }
    };
    const helpMessage = useMemo(() => {
        const repoSetting = selectedConfigurationId && repositoriesRoutes.EditorSettings(selectedConfigurationId);
        const orgSetting = "/settings";
        return (
            <>
                Please contact an admin to update{" "}
                <Link className="underline" to={orgSetting}>
                    organization settings
                </Link>
                {repoSetting && (
                    <>
                        {" or "}
                        <Link className="underline" to={repoSetting}>
                            repository settings
                        </Link>
                    </>
                )}
                .
            </>
        );
    }, [selectedConfigurationId]);

    const ide = selectedIdeOption || computedDefault || "";
    useEffect(() => {
        if (!availableOptions || loading || disabled || ideOptionsLoading) {
            setError?.(undefined);
            return;
        }
        if (availableOptions.length === 0) {
            setError?.(<>No available editors for this repository. {helpMessage}</>);
            return;
        }
        if (!availableOptions.includes(ide)) {
            setError?.(
                <>
                    The editor '{ide}' is not supported. {helpMessage}
                </>,
            );
        } else {
            setError?.(undefined);
        }
    }, [ide, availableOptions, setError, loading, disabled, ideOptionsLoading, helpMessage]);

    return (
        <Combobox
            getElements={getElements}
            onSelectionChange={internalOnSelectionChange}
            searchPlaceholder={"Select Editor"}
            initialValue={ide}
            disabled={disabled || ideOptionsLoading || loading}
        >
            <IdeOptionElementSelected
                option={ideOptions.find((e) => e.id === ide)}
                pinnedIdeVersion={pinnedEditorVersions?.get(ide)}
                useLatest={!!useLatest}
                loading={ideOptionsLoading || loading}
            />
        </Combobox>
    );
}

function parseId(id: string): { ide: string; useLatest: boolean } {
    const useLatest = id.endsWith("-latest");
    const ide = useLatest ? id.slice(0, -7) : id;
    return { ide, useLatest };
}

interface IdeOptionElementProps {
    option: AllowedWorkspaceEditor | undefined;
    pinnedIdeVersion?: string;
    useLatest: boolean;
    loading?: boolean;
}

function capitalize(label?: string) {
    return label && label[0].toLocaleUpperCase() + label.slice(1);
}

const IdeOptionElementSelected: FC<IdeOptionElementProps> = ({
    option,
    pinnedIdeVersion,
    useLatest,
    loading = false,
}) => {
    let version: string | undefined, label: string | undefined, title: string;
    if (!option) {
        title = "Select Editor";
    } else {
        version = useLatest ? option.latestImageVersion : pinnedIdeVersion ?? option.imageVersion;
        label = option.type;
        title = option.title;
    }

    return (
        <ComboboxSelectedItem
            icon={Editor}
            loading={loading}
            htmlTitle={title}
            title={
                <div>
                    {title} <MiddleDot className="text-pk-content-tertiary" />{" "}
                    <span className="font-normal">{version}</span>{" "}
                    {useLatest && (
                        <div className="ml-1 rounded-xl bg-pk-content-tertiary/10 px-2 py-1 inline text-sm font-normal">
                            Latest
                        </div>
                    )}
                </div>
            }
            subtitle={
                <div className="flex gap-0.5">
                    <div className="font-semibold">Editor</div>
                    {label && (
                        <>
                            <MiddleDot />
                            <div>{capitalize(label)}</div>
                        </>
                    )}
                </div>
            }
        />
    );
};

function IdeOptionElementInDropDown(p: IdeOptionElementProps): JSX.Element {
    const { option, useLatest } = p;
    if (!option) {
        return <></>;
    }
    const version = useLatest ? option.latestImageVersion : p.pinnedIdeVersion ?? option.imageVersion;
    const label = capitalize(option.type);

    return (
        <div className="flex" title={option.title}>
            <div className="mx-2 my-2">
                <img className="w-8 h-8 filter-grayscale self-center" src={option.logo} alt="logo" />
            </div>
            <div className="flex self-center text-gray-500">
                <div className="font-semibold text-gray-700 dark:text-gray-300">{option.title}</div>
                {version && (
                    <>
                        <div className="mx-1">&middot;</div>
                        <div>{version}</div>
                    </>
                )}
                {label && (
                    <>
                        <div className="mx-1">&middot;</div>
                        <div>{label}</div>
                    </>
                )}
                {useLatest && <div className="ml-2 rounded-xl bg-gray-200 px-2">Latest</div>}
            </div>
        </div>
    );
}
