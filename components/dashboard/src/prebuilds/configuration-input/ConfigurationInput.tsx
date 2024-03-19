/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useMemo, useState } from "react";
import { useConfiguration, useListConfigurations } from "../../data/configurations/configuration-queries";
import { Combobox, ComboboxElement } from "./Combobox";
import { ComboboxSelectedItem } from "./ComboboxSelectedItem";

type Props = {
    selectedConfigurationId?: string;
    disabled?: boolean;
    expanded?: boolean;
    onChange: (configurationId: string) => void;
};
export const ConfigurationDropdown = ({ selectedConfigurationId, disabled, expanded, onChange }: Props) => {
    const [searchTerm, setSearchTerm] = useState("");
    const { data, isLoading } = useListConfigurations({ searchTerm, sortBy: "creationTime", sortOrder: "desc" });
    const configurations = data?.pages[0].configurations;
    const { data: selectedConfiguration } = useConfiguration(selectedConfigurationId ?? ""); // we don't care if there is no data

    const handleSelectionChange = useCallback(
        (selectedId: string) => {
            onChange(selectedId);
        },
        [onChange],
    );

    // Resolve the selected context url & project id props to a suggestion entry
    const selectedSuggestion = useMemo(() => {
        const match = configurations?.find((config) => {
            return config.id === selectedConfigurationId;
        });

        return match ?? selectedConfiguration;
    }, [configurations, selectedConfiguration, selectedConfigurationId]);

    const getElements = useCallback(() => {
        const resetFilterItem: ComboboxElement = {
            id: "",
            element: <SuggestedRepositoryOption repo={{ name: "Show all" }} />,
            isSelectable: true,
        };

        if (!configurations) {
            return [resetFilterItem];
        }

        const allRepositories = configurations;
        // Make sure we include the user-specified configuration, even if it might not be in our current pagination
        if (selectedConfiguration && !configurations.some((config) => config.id === selectedConfigurationId)) {
            allRepositories.unshift(selectedConfiguration);
        }

        const result = allRepositories.map((repo) => {
            return {
                id: repo.id,
                element: <SuggestedRepositoryOption repo={repo} />,
                isSelectable: true,
            } as ComboboxElement;
        });

        result.unshift(resetFilterItem);

        return result;
    }, [configurations, selectedConfiguration, selectedConfigurationId]);

    return (
        <Combobox
            getElements={getElements}
            expanded={expanded}
            initialValue={selectedConfigurationId}
            // we use this to track the search string so we can search for repos via the api and filter in useUnifiedRepositorySearch
            onSelectionChange={handleSelectionChange}
            disabled={disabled}
            // Only consider the isLoading prop if we're including projects in list
            loading={isLoading}
            onSearchChange={setSearchTerm}
            dropDownClassName="text-pk-content-primary"
        >
            <ComboboxSelectedItem
                htmlTitle="Repository"
                title={<div className="truncate">{selectedSuggestion?.name ?? "Select a repository"}</div>}
                titleClassName="text-sm font-normal text-pk-content-primary"
                loading={isLoading}
            />
        </Combobox>
    );
};

type SuggestedRepositoryOptionProps = {
    repo: {
        name: string;
        cloneUrl?: string;
    };
};
const SuggestedRepositoryOption: FC<SuggestedRepositoryOptionProps> = ({ repo }) => {
    const { name, cloneUrl } = repo;

    return (
        <div className="flex flex-row items-center overflow-hidden" title={cloneUrl} aria-label={`Repository: ${name}`}>
            {name && <span className="text-sm whitespace-nowrap">{name}</span>}
        </div>
    );
};
