/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { FC, useCallback, useEffect, useMemo } from "react";
import { Combobox, ComboboxElement, ComboboxSelectedItem } from "./podkit/combobox/Combobox";
import Editor from "../icons/Editor.svg";
import { useIDEOptions } from "../data/ide-options/ide-options-query";

interface SelectIDEComponentProps {
    selectedIdeOption?: string;
    useLatest?: boolean;
    onSelectionChange: (ide: string, latest: boolean) => void;
    setError?: (error?: string) => void;
    disabled?: boolean;
    loading?: boolean;
}

function filteredIdeOptions(ideOptions: IDEOptions) {
    return IDEOptions.asArray(ideOptions).filter((x) => !x.hidden);
}

function sortedIdeOptions(ideOptions: IDEOptions) {
    return filteredIdeOptions(ideOptions).sort((a, b) => {
        // Prefer experimental options
        if (a.experimental && !b.experimental) {
            return -1;
        }
        if (!a.experimental && b.experimental) {
            return 1;
        }

        if (!a.orderKey || !b.orderKey) {
            return 0;
        }

        return parseInt(a.orderKey, 10) - parseInt(b.orderKey, 10);
    });
}

export default function SelectIDEComponent({
    selectedIdeOption,
    useLatest,
    disabled = false,
    loading = false,
    setError,
    onSelectionChange,
}: SelectIDEComponentProps) {
    const { data: ideOptions, isLoading: ideOptionsLoading } = useIDEOptions();

    const options = useMemo(() => (ideOptions ? sortedIdeOptions(ideOptions) : undefined), [ideOptions]);

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
                        element: <IdeOptionElementInDropDown option={ide} useLatest={false} />,
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
        [options, useLatest],
    );
    const internalOnSelectionChange = (id: string) => {
        const { ide, useLatest } = parseId(id);
        onSelectionChange(ide, useLatest);
        if (setError) {
            setError(undefined);
        }
    };
    const ide = selectedIdeOption || ideOptions?.defaultIde || "";
    useEffect(() => {
        if (!ideOptions) {
            return;
        }
        const option = ideOptions.options[ide];
        if (!option) {
            setError?.(`The editor '${ide}' is not supported.`);
        }
    }, [ide, ideOptions, setError]);
    return (
        <Combobox
            getElements={getElements}
            onSelectionChange={internalOnSelectionChange}
            searchPlaceholder={"Select Editor"}
            initialValue={ide}
            disabled={disabled || ideOptionsLoading || loading}
        >
            <IdeOptionElementSelected
                option={ideOptions?.options[ide]}
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
    option: IDEOption | undefined;
    useLatest: boolean;
    loading?: boolean;
}

function capitalize(label?: string) {
    return label && label[0].toLocaleUpperCase() + label.slice(1);
}

const IdeOptionElementSelected: FC<IdeOptionElementProps> = ({ option, useLatest, loading = false }) => {
    let version: string | undefined, label: string | undefined, title: string;
    if (!option) {
        title = "Select Editor";
    } else {
        version = useLatest ? option.latestImageVersion : option.imageVersion;
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
                    {title} <span className="text-gray-300 dark:text-gray-600 font-normal">&middot;</span>{" "}
                    <span className="text-gray-400 dark:text-gray-500 font-normal">{version}</span>{" "}
                    {useLatest && (
                        <div className="ml-1 rounded-xl bg-gray-200 dark:bg-gray-600 px-2 inline text-sm text-gray-500 dark:text-gray-400 font-normal">
                            Latest
                        </div>
                    )}
                </div>
            }
            subtitle={
                <div className="flex">
                    <div className="font-semibold">Editor</div>
                    {label && (
                        <>
                            <div className="mx-1">&middot;</div>
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
    const version = useLatest ? option.latestImageVersion : option.imageVersion;
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
