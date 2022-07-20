/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { Redirect, useLocation } from "react-router";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { getCurrentTeam, TeamsContext } from "./teams-context";
import { getTeamSettingsMenu } from "./TeamSettings";
import { PaymentContext } from "../payment-context";
import { getGitpodService } from "../service/service";
import { BillableSession, BillableWorkspaceType } from "@gitpod/gitpod-protocol/lib/usage";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Item, ItemField, ItemsList } from "../components/ItemsList";
import moment from "moment";
import Property from "../admin/Property";
import Arrow from "../components/Arrow";

function TeamUsage() {
    const { teams } = useContext(TeamsContext);
    const { showPaymentUI, showUsageBasedUI } = useContext(PaymentContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [billedUsage, setBilledUsage] = useState<BillableSession[]>([]);

    useEffect(() => {
        if (!team) {
            return;
        }
        (async () => {
            const attributionId = AttributionId.render({ kind: "team", teamId: team.id });
            const billedUsageResult = await getGitpodService().server.listBilledUsage(attributionId);
            setBilledUsage(billedUsageResult);
        })();
    }, [team]);

    if (!showUsageBasedUI) {
        return <Redirect to="/" />;
    }

    const getType = (type: BillableWorkspaceType) => {
        if (type === "regular") {
            return "Workspace";
        }
        return "Prebuild";
    };

    const getHours = (endTime: number | undefined, startTime: number) => {
        if (!endTime) return "";

        return (endTime - startTime) / (1000 * 60 * 60) + "hrs";
    };

    return (
        <PageWithSubMenu
            subMenu={getTeamSettingsMenu({ team, showPaymentUI, showUsageBasedUI })}
            title="Usage"
            subtitle="Manage team usage."
        >
            <div className="flex flex-col w-full">
                <div className="flex w-full mt-6 mb-6">
                    <Property name="Last 30 days">Jun 1 - June 30</Property>
                    <Property name="Workspaces">4,200 Min</Property>
                    <Property name="Prebuilds">12,334 Min</Property>
                </div>
            </div>
            <ItemsList className="mt-2 text-gray-500">
                <Item header={false} className="grid grid-cols-6 bg-gray-100">
                    <ItemField className="my-auto">
                        <span>Type</span>
                    </ItemField>
                    <ItemField className="my-auto">
                        <span>Class</span>
                    </ItemField>
                    <ItemField className="my-auto">
                        <span>Amount</span>
                    </ItemField>
                    <ItemField className="my-auto">
                        <span>Credits</span>
                    </ItemField>
                    <ItemField className="my-auto" />
                </Item>
                {billedUsage.map((usage) => (
                    <div
                        key={usage.instanceId}
                        className="flex p-3 grid grid-cols-6 justify-between transition ease-in-out rounded-xl focus:bg-gitpod-kumquat-light"
                    >
                        <div className="my-auto">
                            <span className={usage.workspaceType === "prebuild" ? "text-orange-400" : "text-green-500"}>
                                {getType(usage.workspaceType)}
                            </span>
                        </div>
                        <div className="my-auto">
                            <span className="text-gray-400">{usage.workspaceClass}</span>
                        </div>
                        <div className="my-auto">
                            <span className="text-gray-700">
                                {getHours(
                                    usage.endTime ? new Date(usage.endTime).getTime() : undefined,
                                    new Date(usage.startTime).getTime(),
                                )}
                            </span>
                        </div>
                        <div className="my-auto">
                            <span className="text-gray-700">{usage.credits}</span>
                        </div>
                        <div className="my-auto">
                            <span className="text-gray-400">
                                {moment(new Date(usage.startTime).toDateString()).fromNow()}
                            </span>
                        </div>
                        <div className="pr-2">
                            <Arrow up={false} />
                        </div>
                    </div>
                ))}
            </ItemsList>
        </PageWithSubMenu>
    );
}

export default TeamUsage;
