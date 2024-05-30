/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { workspaceClient } from "../../service/public-api";
import { WorkspaceClass } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { useOrgSettingsQuery } from "../organizations/org-settings-query";
import { Configuration, WorkspaceSettings } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { useMemo } from "react";
import { PlainMessage } from "@bufbuild/protobuf";
import { useConfiguration } from "../configurations/configuration-queries";
import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { useDeepCompareMemoize } from "use-deep-compare-effect";

export const DEFAULT_WS_CLASS = "g1-standard";

export const useWorkspaceClasses = () => {
    return useQuery<WorkspaceClass[]>({
        queryKey: ["workspace-classes"],
        queryFn: async () => {
            const response = await workspaceClient.listWorkspaceClasses({});
            return response.workspaceClasses;
        },
        cacheTime: 1000 * 60 * 60, // 1h
        staleTime: 1000 * 60 * 60, // 1h
    });
};

export type Scope = "organization" | "configuration" | "installation";
export type DisableScope = "organization" | "configuration";
export type AllowedWorkspaceClass = PlainMessage<WorkspaceClass> & {
    isDisabledInScope?: boolean;
    disableScope?: DisableScope;
    isComputedDefaultClass?: boolean;
};

// getNextDefaultClass returns smaller closest one if or larger closest one if there's no smaller ones
export const getNextDefaultClass = (allClasses: AllowedWorkspaceClass[], defaultClass?: string) => {
    const availableClasses = allClasses.filter((e) => !e.isDisabledInScope);
    if (availableClasses.length === 0) {
        return undefined;
    }
    if (defaultClass) {
        if (availableClasses.some((cls) => cls.id === defaultClass)) {
            return defaultClass;
        }
    }
    const defaultIndexInAll = allClasses.findIndex((cls) => cls.id === defaultClass);
    if (defaultIndexInAll === -1) {
        return undefined;
    }
    // remove unavailable default class
    const sortedClasses = [
        ...allClasses.slice(0, defaultIndexInAll).reverse(),
        ...allClasses.slice(defaultIndexInAll, allClasses.length),
    ].filter((cls) => !cls.isDisabledInScope);
    if (sortedClasses.length > 0) {
        return sortedClasses[0].id;
    }
    return undefined;
};

export const getAllowedWorkspaceClasses = (
    installationClasses: WorkspaceClass[] | undefined,
    orgSettings: Pick<OrganizationSettings, "allowedWorkspaceClasses"> | undefined,
    repoRestrictedClass: WorkspaceSettings["restrictedWorkspaceClasses"] | undefined,
    repoDefaultClass: WorkspaceSettings["workspaceClass"] | undefined,
    options?: { filterOutDisabled: boolean; ignoreScope?: DisableScope[] },
) => {
    let data: AllowedWorkspaceClass[] = installationClasses ?? [];
    let scope: Scope = "installation";
    if (data.length === 0) {
        return { data, scope, computedDefaultClass: DEFAULT_WS_CLASS };
    }
    if (
        !options?.ignoreScope?.includes("organization") &&
        orgSettings?.allowedWorkspaceClasses &&
        orgSettings.allowedWorkspaceClasses.length > 0
    ) {
        data = data.map((cls) => ({
            ...cls,
            isDisabledInScope: !orgSettings.allowedWorkspaceClasses.includes(cls.id),
            disableScope: "organization",
        }));
        scope = "organization";
    }
    if (!options?.ignoreScope?.includes("configuration") && repoRestrictedClass && repoRestrictedClass.length > 0) {
        data = data.map((cls) => {
            if (cls.isDisabledInScope) {
                return cls;
            }
            return {
                ...cls,
                isDisabledInScope: repoRestrictedClass.includes(cls.id),
                disableScope: "configuration",
            };
        });
        scope = "configuration";
    }
    const computedDefaultClass = getNextDefaultClass(data, repoDefaultClass ?? DEFAULT_WS_CLASS) ?? DEFAULT_WS_CLASS;
    data = data.map((e) => {
        if (e.id === computedDefaultClass) {
            e.isComputedDefaultClass = true;
        }
        return e;
    });
    if (options?.filterOutDisabled) {
        return { data: data.filter((e) => !e.isDisabledInScope), scope, computedDefaultClass };
    }
    return { data, scope, computedDefaultClass };
};

export const useAllowedWorkspaceClassesMemo = (
    configurationId?: Configuration["id"],
    options?: { filterOutDisabled: boolean; ignoreScope?: DisableScope[] },
) => {
    const { data: orgSettings, isLoading: isLoadingOrgSettings } = useOrgSettingsQuery();
    const { data: installationClasses, isLoading: isLoadingInstallationCls } = useWorkspaceClasses();
    // empty configurationId will return undefined
    const { data: configuration, isLoading: isLoadingConfiguration } = useConfiguration(configurationId);

    const isLoading = isLoadingOrgSettings || isLoadingInstallationCls || isLoadingConfiguration;

    const depItems = [
        installationClasses,
        orgSettings,
        options,
        configuration?.workspaceSettings?.restrictedWorkspaceClasses,
        configuration?.workspaceSettings?.workspaceClass,
    ];
    const data = useMemo(() => {
        return getAllowedWorkspaceClasses(
            installationClasses,
            orgSettings,
            configuration?.workspaceSettings?.restrictedWorkspaceClasses,
            configuration?.workspaceSettings?.workspaceClass,
            options,
        );
        // react useMemo is using `Object.is` to compare dependencies so array / object will make re-render re-call useMemo,
        // see also https://react.dev/reference/react/useMemo#every-time-my-component-renders-the-calculation-in-usememo-re-runs
        //
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useDeepCompareMemoize(depItems)]);
    return { ...data, isLoading };
};
