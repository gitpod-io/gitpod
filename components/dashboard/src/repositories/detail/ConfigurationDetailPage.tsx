/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { BreadcrumbNav } from "@podkit/breadcrumbs/BreadcrumbNav";
import { Button } from "@podkit/buttons/Button";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { useMemo } from "react";
import Alert from "../../components/Alert";
import { WidePageWithSubMenu } from "../../components/WidePageWithSubmenu";
import type { SubmenuItemProps } from "../../components/PageWithSubMenu";

export interface PageWithAdminSubMenuProps {
    children: React.ReactNode;
    configurationQuery: UseQueryResult<Configuration | undefined, Error>;
    id: string;
}

export function ConfigurationDetailPage({ children, configurationQuery, id }: PageWithAdminSubMenuProps) {
    const { data, error, isLoading, refetch } = configurationQuery;

    const settingsMenu = useMemo(() => {
        return getConfigurationsMenu(id);
    }, [id]);

    return (
        <div className="w-full">
            <BreadcrumbNav
                pageTitle="Repository Configuration"
                pageDescription={data?.name ?? ""}
                backLink="/repositories"
            />
            <WidePageWithSubMenu subMenu={settingsMenu} navTitle="Configuration Settings">
                {isLoading && <Loader2 className="animate-spin" />}
                {error ? (
                    <div className="gap-4">
                        <Alert type="error">
                            <span>Failed to load repository configuration</span>
                            <pre>{error.message}</pre>
                        </Alert>
                        <Button
                            variant={"destructive"}
                            onClick={() => {
                                refetch();
                            }}
                        >
                            Retry
                        </Button>
                    </div>
                ) : (
                    !isLoading &&
                    (!data ? (
                        // TODO: add a better not-found UI w/ link back to repositories
                        <div>Sorry, we couldn't find that repository configuration.</div>
                    ) : (
                        children
                    ))
                )}
            </WidePageWithSubMenu>
        </div>
    );
}

function getConfigurationsMenu(id: string): SubmenuItemProps[] {
    const base = `/repositories/${id}`;
    return [
        {
            title: "General",
            link: [base],
        },
        {
            title: "Gitpod YAML",
            link: [`${base}/configuration`],
            icon: <HelpCircle size={20} />,
        },
        {
            title: "Prebuilds",
            link: [`${base}/prebuilds`],
            icon: <AlertTriangle size={20} />,
        },
        {
            title: "Environment variables",
            link: [`${base}/variables`],
        },
        {
            title: "Workspace defaults",
            link: [`${base}/workspaces`],
        },
    ];
}
