/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMemo } from "react";
import { PageWithSubMenu } from "../../components/PageWithSubMenu";
import { Button } from "@podkit/buttons/Button";
import Alert from "../../components/Alert";
import { Loader2 } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Project } from "@gitpod/gitpod-protocol";

export interface PageWithAdminSubMenuProps {
    children: React.ReactNode;
    projectQuery: UseQueryResult<Project | null, Error>;
    id: string;
}

export function ConfigurationDetailPage({ children, projectQuery, id }: PageWithAdminSubMenuProps) {
    const { data, error, isLoading, refetch } = projectQuery;

    const settingsMenu = useMemo(() => {
        return getSettingsMenu(id);
    }, [id]);

    return (
        <PageWithSubMenu
            subMenu={settingsMenu}
            title={data?.name ?? id}
            subtitle="Change settings of this configuration"
        >
            {isLoading && <Loader2 className="animate-spin" />}
            {error && (
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
            )}
            {!isLoading &&
                (!data ? (
                    // TODO: add a better not-found UI w/ link back to repositories
                    <div>Sorry, we couldn't find that repository configuration.</div>
                ) : (
                    children
                ))}
        </PageWithSubMenu>
    );
}

function getSettingsMenu(id: string) {
    const base = `/configurations/${id}`;
    return [
        {
            title: "General",
            link: [base],
        },
        {
            title: "Gitpod YAML",
            link: [`${base}/configuration`],
        },
        {
            title: "Prebuilds",
            link: [`${base}/prebuilds`],
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
