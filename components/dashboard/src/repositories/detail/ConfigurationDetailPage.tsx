/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BreadcrumbNav } from "@podkit/breadcrumbs/BreadcrumbNav";
import { Button } from "@podkit/buttons/Button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { FC, useMemo } from "react";
import Alert from "../../components/Alert";
import { WidePageWithSubMenu } from "../../components/WidePageWithSubmenu";
import type { SubmenuItemProps } from "../../components/PageWithSubMenu";
import { Route, Switch, useParams, useRouteMatch } from "react-router";
import { useConfiguration } from "../../data/configurations/configuration-queries";
import { ConfigurationDetailGeneral } from "./ConfigurationDetailGeneral";
import { ConfigurationDetailWorkspaces } from "./ConfigurationDetailWorkspaces";
import { ConfigurationDetailPrebuilds } from "./ConfigurationDetailPrebuilds";
import { ConfigurationVariableList } from "./variables/ConfigurationVariableList";

type PageRouteParams = {
    id: string;
};

const ConfigurationDetailPage: FC = () => {
    const { id } = useParams<PageRouteParams>();
    let { path, url } = useRouteMatch();

    const { data, error, isLoading, refetch } = useConfiguration(id);
    const prebuildsEnabled = !!data?.prebuildSettings?.enabled;

    const settingsMenu = useMemo(() => {
        const menu: SubmenuItemProps[] = [
            {
                title: "General",
                link: [url],
            },
            {
                title: "Prebuilds",
                link: [`${url}/prebuilds`],
                icon: !prebuildsEnabled ? <AlertTriangle size={20} /> : undefined,
            },
            {
                title: "Environment variables",
                link: [`${url}/variables`],
            },
            {
                title: "Workspace defaults",
                link: [`${url}/workspaces`],
            },
        ];
        return menu;
    }, [prebuildsEnabled, url]);

    return (
        <div className="w-full">
            <BreadcrumbNav
                pageTitle="Imported repositories"
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
                        <div className="flex flex-col gap-4">
                            <Switch>
                                <Route exact path={path}>
                                    <ConfigurationDetailGeneral configuration={data} />
                                </Route>
                                <Route exact path={`${path}/workspaces`}>
                                    <ConfigurationDetailWorkspaces configuration={data} />
                                </Route>
                                <Route exact path={`${path}/prebuilds`}>
                                    <ConfigurationDetailPrebuilds configuration={data} />
                                </Route>
                                <Route exact path={`${path}/variables`}>
                                    <ConfigurationVariableList configuration={data} />
                                </Route>
                            </Switch>
                        </div>
                    ))
                )}
            </WidePageWithSubMenu>
        </div>
    );
};

export default ConfigurationDetailPage;
