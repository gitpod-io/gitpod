/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useMemo } from "react";
import ContextMenu, { ContextMenuEntry } from "../../components/ContextMenu";
import { useFilteredAndSortedIDEOptions } from "../../data/ide-options/ide-options-query";
import { Button } from "../../components/Button";
import Arrow from "../../components/Arrow";
import Editor from "../../icons/Editor.svg";
import { IdeOptionElementInDropDown } from "../../components/SelectIDEComponent";

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
            customContent: <IdeOptionElementInDropDown option={ide} useLatest={useLatestIDE} />,
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
        <ContextMenu menuEntries={menuEntries} customClasses="right-0">
            {/* {selectedOption ? (
                <IdeOptionElementSelected option={selectedOption} useLatest={useLatestIDE} loading={isLoading} />
            ) : (
                <span>Please select an Editor</span>
            )} */}
            <Button
                type="secondary"
                size="small"
                icon={<img className="w-4 filter-grayscale" src={Editor} alt="logo" />}
            >
                {/* <span className="flex flex-row gap-1 items-center"> */}
                {/* <img className="w-4 filter-grayscale" src={Editor} alt="logo" /> */}
                <span className="font-semibold">{selectedOption?.title ?? "unknown"}</span>
                {selectedOption?.label && (
                    <>
                        <span className="text-gray-300 dark:text-gray-600 font-normal">&middot;</span>
                        <span className="text-sm">{selectedOption?.label}</span>
                    </>
                )}
                <Arrow direction={"down"} />
                {/* </span> */}
            </Button>
        </ContextMenu>
    );
};
