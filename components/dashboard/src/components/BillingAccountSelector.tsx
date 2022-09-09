/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { Team, TeamMemberInfo } from "@gitpod/gitpod-protocol";
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
    const [membersByTeam, setMembersByTeam] = useState<Record<string, TeamMemberInfo[]>>({});

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
        ).then(() => setTeamsWithBillingEnabled(teamsWithBilling.sort((a, b) => (a.name > b.name ? 1 : -1))));
    }, [teams]);

    useEffect(() => {
        if (!teamsWithBillingEnabled) {
            return;
        }
        (async () => {
            const members: Record<string, TeamMemberInfo[]> = {};
            await Promise.all(
                teamsWithBillingEnabled.map(async (team) => {
                    try {
                        members[team.id] = await getGitpodService().server.getTeamMembers(team.id);
                    } catch (error) {
                        console.error("Could not get members of team", team, error);
                    }
                }),
            );
            setMembersByTeam(members);
        })();
    }, [teamsWithBillingEnabled]);

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
                    <p>Associate all my usage with the billing account below.</p>
                    <div className="mt-4 max-w-2xl grid grid-cols-3 gap-3">
                        <SelectableCardSolid
                            className="h-18"
                            title="(myself)"
                            selected={
                                !!user &&
                                selectedAttributionId === AttributionId.render({ kind: "user", userId: user.id })
                            }
                            onClick={() => setUsageAttributionTeam(undefined)}
                        >
                            <div className="flex-grow flex items-end px-1">
                                <span className="text-sm text-gray-400">Personal Account</span>
                            </div>
                        </SelectableCardSolid>
                        {teamsWithBillingEnabled.length === 0 && (
                            <span className="col-span-3">
                                Please enable billing for one of your teams, or create a new team and enable billing for
                                it.
                            </span>
                        )}
                        {teamsWithBillingEnabled.map((t) => (
                            <SelectableCardSolid
                                className="h-18"
                                title={t.name}
                                selected={
                                    selectedAttributionId === AttributionId.render({ kind: "team", teamId: t.id })
                                }
                                onClick={() => setUsageAttributionTeam(t)}
                            >
                                <div className="flex-grow flex items-end px-1">
                                    <span className="text-sm text-gray-400">
                                        {!!membersByTeam[t.id]
                                            ? `${membersByTeam[t.id].length} member${
                                                  membersByTeam[t.id].length === 1 ? "" : "s"
                                              }`
                                            : "..."}
                                    </span>
                                </div>
                            </SelectableCardSolid>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
