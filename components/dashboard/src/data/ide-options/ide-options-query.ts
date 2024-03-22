/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { DisableScope, Scope } from "../workspaces/workspace-classes-query";
import { useOrgSettingsQuery } from "../organizations/org-settings-query";
import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { useMemo } from "react";
import { useCurrentOrg } from "../organizations/orgs-query";
import { useConfiguration } from "../configurations/configuration-queries";

const DEFAULT_WS_EDITOR = "code";

export const useIDEOptions = () => {
    return useQuery(
        ["ide-options"],
        async () => {
            return await getGitpodService().server.getIDEOptions();
        },
        {
            staleTime: 1000 * 60 * 60 * 1, // 1h
            cacheTime: 1000 * 60 * 60 * 1, // 1h
        },
    );
};

export const useIDEVersionsQuery = (pinnableIdeIdList?: string[]) => {
    return useQuery(
        ["ide-versions", pinnableIdeIdList?.join(",")],
        async () => {
            const updatedVal: Record<string, string[]> = {};
            if (!pinnableIdeIdList) {
                return updatedVal;
            }
            const ideVersionsResult = await Promise.all(
                pinnableIdeIdList.map((ide) => getGitpodService().server.getIDEVersions(ide)),
            );
            for (let i = 0; i < pinnableIdeIdList.length; i++) {
                const versions = ideVersionsResult[i]!;
                updatedVal[pinnableIdeIdList[i]] = versions;
            }
            return updatedVal;
        },
        {
            staleTime: 1000 * 60 * 10, // 10m
            cacheTime: 1000 * 60 * 10, // 10m
        },
    );
};

export type AllowedWorkspaceEditor = IDEOption & {
    id: string;
    isDisabledInScope?: boolean;
    disableScope?: DisableScope;
    isComputedDefault?: boolean;
};

interface FilterOptions {
    filterOutDisabled: boolean;
    userDefault?: string;
    ignoreScope?: DisableScope[];
}
export const useAllowedWorkspaceEditorsMemo = (configurationId: string | undefined, options?: FilterOptions) => {
    const organizationId = useCurrentOrg().data?.id;
    const { data: orgSettings, isLoading: isLoadingOrgSettings } = useOrgSettingsQuery();
    const { data: installationOptions, isLoading: isLoadingInstallationCls } = useIDEOptions();
    const { data: configuration, isLoading: isLoadingConfiguration } = useConfiguration(configurationId ?? "");
    let isLoading = isLoadingOrgSettings || isLoadingInstallationCls || isLoadingConfiguration;
    if (!organizationId) {
        // If there's no orgID set (i.e. User onboarding page), isLoadingOrgSettings will always be true
        // So we will filter it out
        isLoading = isLoadingInstallationCls || isLoadingConfiguration;
    }
    const data = useMemo(() => {
        return getAllowedWorkspaceEditors(
            installationOptions,
            orgSettings,
            configuration?.workspaceSettings?.restrictedEditorNames,
            options,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        installationOptions,
        options?.ignoreScope,
        orgSettings,
        configuration?.workspaceSettings?.restrictedEditorNames,
    ]);
    return { ...data, isLoading, usingConfigurationId: configuration?.id };
};

const getAllowedWorkspaceEditors = (
    installationOptions: IDEOptions | undefined,
    orgSettings: Pick<OrganizationSettings, "restrictedEditorNames"> | undefined,
    repoRestrictedEditorNames: string[] | undefined,
    options?: FilterOptions,
) => {
    let data: AllowedWorkspaceEditor[] = [];
    const baseDefault = options?.userDefault ?? DEFAULT_WS_EDITOR;

    if (installationOptions?.options) {
        data = Object.entries(installationOptions.options)
            .map(([key, value]) => ({
                ...value,
                id: key,
            }))
            .sort(IdeOptionsSorter);
    }
    let scope: Scope = "installation";
    if (data.length === 0) {
        return { data, scope, computedDefault: baseDefault, availableOptions: [] };
    }
    if (
        !options?.ignoreScope?.includes("organization") &&
        orgSettings?.restrictedEditorNames &&
        orgSettings.restrictedEditorNames.length > 0
    ) {
        data = data.map((d) => ({
            ...d,
            isDisabledInScope: orgSettings.restrictedEditorNames.includes(d.id),
            disableScope: "organization",
        }));
        scope = "organization";
    }
    if (
        !options?.ignoreScope?.includes("configuration") &&
        repoRestrictedEditorNames &&
        repoRestrictedEditorNames.length > 0
    ) {
        data = data.map((d) => {
            if (d.isDisabledInScope) {
                return d;
            }
            return {
                ...d,
                isDisabledInScope: repoRestrictedEditorNames.includes(d.id),
                disableScope: "configuration",
            };
        });
        scope = "configuration";
    }

    let computedDefault = options?.userDefault;
    const allowedList = data.filter((e) => !e.isDisabledInScope);
    if (!allowedList.some((d) => d.id === options?.userDefault && !d.isDisabledInScope)) {
        computedDefault = allowedList.length > 0 ? allowedList[0].id : baseDefault;
    }
    data = data.map((e) => {
        if (e.id === computedDefault) {
            e.isComputedDefault = true;
        }
        return e;
    });
    const availableOptions = allowedList.map((e) => e.id);
    if (options?.filterOutDisabled) {
        return { data: allowedList, scope, computedDefault, availableOptions };
    }
    return { data, scope, computedDefault, availableOptions };
};

function IdeOptionsSorter(
    a: Pick<IDEOption, "experimental" | "orderKey">,
    b: Pick<IDEOption, "experimental" | "orderKey">,
) {
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
}
