/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback } from "react";
import { DropDown2, DropDown2Element, DropDown2SelectedElement } from "./DropDown2";
import Repository from "../icons/Repository.svg";
import { useRepositorySearch } from "../data/git-providers/repository-search-query";

interface RepositoryFinderProps {
    initialValue?: string;
    maxDisplayItems?: number;
    setSelection?: (selection: string) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
    loading?: boolean;
}

function stripOffProtocol(url: string): string {
    if (!url.startsWith("http")) {
        return url;
    }
    return url.substring(url.indexOf("//") + 2);
}

export default function RepositoryFinder(props: RepositoryFinderProps) {
    const { data: contextURLs } = useRepositorySearch({
        search: props.initialValue,
    });

    const getDropdownOptions = useCallback(() => {
        const options = contextURLs.map((contextURL): DropDown2Element => {
            return {
                id: contextURL,
                element: (
                    <div className="flex-col ml-1 mt-1 flex-grow">
                        <div className="flex">
                            <div className="text-gray-700 dark:text-gray-300 font-semibold">
                                {stripOffProtocol(contextURL)}
                            </div>
                            <div className="ml-1 text-gray-400">{}</div>
                        </div>
                        <div className="flex text-xs text-gray-400">{}</div>
                    </div>
                ),
                isSelectable: true,
            };
        });

        return options;
    }, [contextURLs]);

    const selectedElement = (
        <DropDown2SelectedElement
            iconSrc={Repository}
            htmlTitle={displayContextUrl(props.initialValue) || "Repository"}
            title={
                <div className="truncate w-80">{displayContextUrl(props.initialValue) || "Select a repository"}</div>
            }
            subtitle="Context URL"
            loading={props.loading}
        />
    );

    if (!props.setSelection) {
        // readonly display value
        return <div className="m-2">{selectedElement}</div>;
    }

    return (
        <DropDown2
            getElements={getDropdownOptions}
            expanded={!props.initialValue}
            onSelectionChange={props.setSelection}
            disabled={props.disabled}
            searchPlaceholder="Paste repository URL or type to find suggestions"
        >
            {selectedElement}
        </DropDown2>
    );
}

function displayContextUrl(contextUrl?: string) {
    if (!contextUrl) {
        return undefined;
    }
    return stripOffProtocol(contextUrl);
}
