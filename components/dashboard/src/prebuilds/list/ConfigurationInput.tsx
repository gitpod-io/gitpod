/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useMemo, useState } from "react";
import { useConfiguration, useListConfigurations } from "../../data/configurations/configuration-queries";
import { Combobox, ComboboxElement, ComboboxSelectedItem } from "@podkit/combobox/Combobox";

interface RepositoryFinderProps {
    selectedConfigurationId?: string;
    disabled?: boolean;
    expanded?: boolean;
    onChange: (configurationId: string) => void;
}

export default function ConfigurationDropdown({
    selectedConfigurationId,
    disabled,
    expanded,
    onChange,
}: RepositoryFinderProps) {
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

        return match;
    }, [configurations, selectedConfigurationId]);

    const getElements = useCallback(() => {
        if (!configurations) {
            return [];
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

        result.unshift({
            id: "",
            element: <SuggestedRepositoryOption repo={{ name: "Show all" }} />,
            isSelectable: true,
        });

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
            className="h-8 w-48 bg-pk-surface-primary hover:bg-pk-surface-primary px-0 border border-pk-border-base text-sm text-pk-content-primary"
            itemClassName="font-normal"
        >
            <ComboboxSelectedItem
                htmlTitle="Repository"
                title={<div className="truncate">{selectedSuggestion?.name ?? "Select a repository"}</div>}
                titleClassName="text-sm font-normal text-pk-content-primary"
                loading={isLoading}
            />
        </Combobox>
    );
}

type SuggestedRepositoryOptionProps = {
    repo: {
        name: string;
    };
};
const SuggestedRepositoryOption: FC<SuggestedRepositoryOptionProps> = ({ repo }) => {
    const { name } = repo;

    return (
        <div className="flex flex-row items-center overflow-hidden" aria-label={`Repository: ${name}`}>
            {name && <span className="text-sm whitespace-nowrap font-semibold">{name}</span>}
        </div>
    );
};
