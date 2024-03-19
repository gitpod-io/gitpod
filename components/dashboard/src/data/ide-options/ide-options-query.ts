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
export const useAllowedWorkspaceEditorsMemo = (options?: FilterOptions) => {
    const organizationId = useCurrentOrg().data?.id;
    const { data: orgSettings, isLoading: isLoadingOrgSettings } = useOrgSettingsQuery();
    const { data: installationOptions, isLoading: isLoadingInstallationCls } = useIDEOptions();
    // TODO: repo-level
    // If there's no orgID set (i.e. User onboarding page), isLoadingOrgSettings will always be true
    // So we will filter it out
    const isLoading = organizationId ? isLoadingOrgSettings || isLoadingInstallationCls : isLoadingInstallationCls;
    const data = useMemo(() => {
        const result = getAllowedWorkspaceEditors(installationOptions, orgSettings, options);
        return {
            ...result,
            data: toIDEOptions(installationOptions, result.data),
        };
    }, [installationOptions, orgSettings, options]);
    return { ...data, isLoading };
};

const getAllowedWorkspaceEditors = (
    installationOptions: IDEOptions | undefined,
    orgSettings: Pick<OrganizationSettings, "restrictedEditorNames"> | undefined,
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
        return { data, scope, computedDefault: baseDefault };
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
    // TODO: repo-level

    let computedDefault = options?.userDefault;
    const allowedList = data.filter((d) => !d.isDisabledInScope);
    if (!allowedList.some((d) => d.id === options?.userDefault && !d.isDisabledInScope)) {
        computedDefault = allowedList.length > 0 ? allowedList[0].id : baseDefault;
    }
    data = data.map((e) => {
        if (e.id === computedDefault) {
            e.isComputedDefault = true;
        }
        return e;
    });
    if (options?.filterOutDisabled) {
        return { data: data.filter((e) => !e.isDisabledInScope), scope, computedDefault };
    }
    return { data, scope, computedDefault };
};

export type LocalIDEOptions = Omit<IDEOptions, "options"> & { options: { [key: string]: AllowedWorkspaceEditor } };

const toIDEOptions = (
    installationOptions: IDEOptions | undefined,
    allowedList: AllowedWorkspaceEditor[],
): LocalIDEOptions | undefined => {
    if (!installationOptions) {
        return undefined;
    }
    return {
        ...installationOptions,
        options: allowedList.reduce((acc, cur) => {
            acc[cur.id] = cur;
            return acc;
        }, {} as { [key: string]: AllowedWorkspaceEditor }),
    };
};

export function IdeOptionsSorter(
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
