/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { Team } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { getGitpodService } from "../service/service";
import { TeamsContext } from "../teams/teams-context";
import { UserContext } from "../user-context";
import SelectableCardSolid from "../components/SelectableCardSolid";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";

export function BillingAccountSelector(props: { onSelected?: () => void }) {
    const { user, setUser } = useContext(UserContext);
    const { teams } = useContext(TeamsContext);
    const [teamsWithBillingEnabled, setTeamsWithBillingEnabled] = useState<Team[] | undefined>();

    useEffect(() => {
        if (!teams) {
            setTeamsWithBillingEnabled(undefined);
            return;
        }
        const teamsWithBilling: Team[] = [];
        Promise.all(
            teams.map(async (t) => {
                const subscriptionId = await getGitpodService().server.findStripeSubscriptionIdForTeam(t.id);
                if (subscriptionId) {
                    teamsWithBilling.push(t);
                }
            }),
        ).then(() => setTeamsWithBillingEnabled(teamsWithBilling));
    }, [teams]);

    const setUsageAttributionTeam = async (team?: Team) => {
        if (!user) {
            return;
        }
        const usageAttributionId = AttributionId.render(
            team ? { kind: "team", teamId: team.id } : { kind: "user", userId: user.id },
        );
        await getGitpodService().server.setUsageAttribution(usageAttributionId);
        setUser(await getGitpodService().server.getLoggedInUser());
        if (props.onSelected) {
            props.onSelected();
        }
    };

    let selectedAttributionId = user?.usageAttributionId;
    if (!selectedAttributionId && teamsWithBillingEnabled?.length === 1) {
        // When the user hasn't selected a billing account, but there is only one possible billing account,
        // we auto-select that one.
        selectedAttributionId = AttributionId.render({ kind: "team", teamId: teamsWithBillingEnabled[0].id });
    }

    return (
        <>
            {teamsWithBillingEnabled === undefined && <Spinner className="m-2 h-5 w-5 animate-spin" />}
            {teamsWithBillingEnabled && (
                <div>
                    <p>Bill all my usage to:</p>
                    <div className="mt-4 flex space-x-3">
                        <SelectableCardSolid
                            className="w-36 h-32"
                            title="(myself)"
                            selected={
                                !!user &&
                                selectedAttributionId === AttributionId.render({ kind: "user", userId: user.id })
                            }
                            onClick={() => setUsageAttributionTeam(undefined)}
                        >
                            <div className="flex-grow flex items-end p-1"></div>
                        </SelectableCardSolid>
                        {teamsWithBillingEnabled.map((t) => (
                            <SelectableCardSolid
                                className="w-36 h-32"
                                title={t.name}
                                selected={
                                    selectedAttributionId === AttributionId.render({ kind: "team", teamId: t.id })
                                }
                                onClick={() => setUsageAttributionTeam(t)}
                            >
                                <div className="flex-grow flex items-end p-1"></div>
                            </SelectableCardSolid>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
