/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { useCallback, useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import { DropDown2, DropDown2Element } from "./DropDown2";
import Editor from "../icons/Editor.svg";

interface SelectIDEComponentProps {
    selectedIdeOption?: string;
    useLatest?: boolean;
    onSelectionChange: (ide: string, latest: boolean) => void;
    setError?: (error?: string) => void;
}

export default function SelectIDEComponent(props: SelectIDEComponentProps) {
    const [ideOptions, setIdeOptions] = useState<IDEOptions>();
    useEffect(() => {
        getGitpodService().server.getIDEOptions().then(setIdeOptions);
    }, []);
    const getElements = useCallback(
        (search: string) => {
            if (!ideOptions) {
                return [];
            }
            const options = IDEOptions.asArray(ideOptions);
            const result: DropDown2Element[] = [];
            for (const ide of options.filter((ide) =>
                `${ide.label}${ide.title}${ide.notes}${ide.id}`.toLowerCase().includes(search.toLowerCase()),
            )) {
                if (!props.useLatest) {
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
        [ideOptions, props.useLatest],
    );
    const internalOnSelectionChange = (id: string) => {
        const { ide, useLatest } = parseId(id);
        props.onSelectionChange(ide, useLatest);
        if (props.setError) {
            props.setError(undefined);
        }
    };
    const ide = props.selectedIdeOption || ideOptions?.defaultIde || "";
    useEffect(() => {
        if (!ideOptions) {
            return;
        }
        const option = ideOptions.options[ide];
        if (!option) {
            props.setError?.(`The editor '${ide}' is not supported.`);
        }
    }, [ide, ideOptions, props]);
    return (
        <DropDown2
            getElements={getElements}
            onSelectionChange={internalOnSelectionChange}
            searchPlaceholder={"Select Editor"}
            allOptions={ide}
        >
            <IdeOptionElementSelected option={ideOptions?.options[ide]} useLatest={!!props.useLatest} />
        </DropDown2>
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
}

function capitalize(label?: string) {
    return label && label[0].toLocaleUpperCase() + label.slice(1);
}

function IdeOptionElementSelected({ option, useLatest }: IdeOptionElementProps): JSX.Element {
    let version: string | undefined, label: string | undefined, title: string;
    if (!option) {
        title = "Select Editor";
    } else {
        version = useLatest ? option.latestImageVersion : option.imageVersion;
        label = option.type;
        title = option.title;
    }

    return (
        <div className="flex" title={title}>
            <div className="mx-2 my-2">
                <img className="w-8 filter-grayscale self-center" src={Editor} alt="logo" />
            </div>
            <div className="flex-col ml-1 mt-1 flex-grow">
                <div className="text-gray-700 dark:text-gray-300 font-semibold">Editor</div>
                <div className="flex text-xs text-gray-500 dark:text-gray-400">
                    <div className="font-semibold">{title}</div>
                    {version && (
                        <>
                            <div className="mx-1">&middot;</div>
                            <div>{version}</div>
                        </>
                    )}
                    {label && (
                        <>
                            <div className="mx-1">&middot;</div>
                            <div>{capitalize(label)}</div>
                        </>
                    )}
                    {useLatest && <div className="ml-2 rounded-xl bg-gray-200 dark:bg-gray-600 px-2">Latest</div>}
                </div>
            </div>
        </div>
    );
}

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
                <img className="w-8 filter-grayscale self-center" src={option.logo} alt="logo" />
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
