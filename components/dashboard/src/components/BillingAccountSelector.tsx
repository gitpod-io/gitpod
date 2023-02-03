/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { Team, TeamMemberInfo } from "@gitpod/gitpod-protocol";
import { AttributionId, AttributionTarget } from "@gitpod/gitpod-protocol/lib/attribution";
import { getGitpodService } from "../service/service";
import { useTeams } from "../teams/teams-context";
import { UserContext } from "../user-context";
import SelectableCardSolid from "../components/SelectableCardSolid";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import Alert from "./Alert";
import { publicApiTeamMembersToProtocol, teamsService } from "../service/public-api";

export function BillingAccountSelector(props: { onSelected?: () => void }) {
    const { user, setUser } = useContext(UserContext);
    const teams = useTeams();
    const [teamsAvailableForAttribution, setTeamsAvailableForAttribution] = useState<Team[] | undefined>();
    const [membersByTeam, setMembersByTeam] = useState<Record<string, TeamMemberInfo[]>>({});
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    useEffect(() => {
        if (!teams) {
            setTeamsAvailableForAttribution(undefined);
            return;
        }

        // Fetch the list of orgs we can actually attribute to
        getGitpodService()
            .server.listAvailableUsageAttributionIds()
            .then((attrIds) => {
                const teamsAvailableForAttribution = [];
                for (const attrId of attrIds.map(AttributionId.parse)) {
                    if (attrId?.kind !== "team") {
                        continue;
                    }
                    const team = teams.find((t) => t.id === attrId.teamId);
                    if (team) {
                        teamsAvailableForAttribution.push(team);
                    }
                }
                setTeamsAvailableForAttribution(
                    teamsAvailableForAttribution.sort((a, b) => (a.name > b.name ? 1 : -1)),
                );
            })
            .catch((error) => {
                console.error("Could not get list of available billing accounts.", error);
                setErrorMessage(`Could not get list of available billing accounts. ${error?.message || String(error)}`);
            });

        const members: Record<string, TeamMemberInfo[]> = {};
        Promise.all(
            teams.map(async (team) => {
                try {
                    members[team.id] = publicApiTeamMembersToProtocol(
                        (await teamsService.getTeam({ teamId: team!.id })).team?.members || [],
                    );
                } catch (error) {
                    console.warn("Could not get members of org", team, error);
                }
            }),
        ).then(() => setMembersByTeam(members));
    }, [teams]);

    const setUsageAttributionTeam = async (team?: Team) => {
        if (!user) {
            return;
        }
        const usageAttributionId = AttributionId.render(
            team ? { kind: "team", teamId: team.id } : { kind: "user", userId: user.id },
        );
        await getGitpodService().server.setUsageAttribution(usageAttributionId);
        // we changed the user, to let's propagate in the frontend
        setUser(await getGitpodService().server.getLoggedInUser());
        if (props.onSelected) {
            props.onSelected();
        }
    };

    let selectedAttributionId = user?.usageAttributionId || AttributionId.render({ kind: "user", userId: user?.id! });

    const isSelected = (kind: AttributionTarget, accountId: string): boolean =>
        selectedAttributionId ===
        AttributionId.render(kind === "user" ? { kind, userId: accountId } : { kind, teamId: accountId });

    return (
        <>
            {errorMessage && (
                <Alert className="max-w-xl mt-2" closable={false} showIcon={true} type="error">
                    {errorMessage}
                </Alert>
            )}
            {teamsAvailableForAttribution === undefined && <Spinner className="m-2 h-5 w-5 animate-spin" />}
            {teamsAvailableForAttribution && (
                <div>
                    <h2 className="text-gray-500">
                        Associate usage without a project to the billing account below.{" "}
                        <a
                            className="gp-link"
                            href="https://www.gitpod.io/docs/configure/billing"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Learn more
                        </a>
                    </h2>
                    <div className="mt-4 max-w-2xl grid grid-cols-3 gap-3">
                        {!user?.additionalData?.isMigratedToTeamOnlyAttribution && (
                            <SelectableCardSolid
                                className="h-18"
                                title="(myself)"
                                selected={!!user && isSelected("user", user.id)}
                                onClick={() => setUsageAttributionTeam(undefined)}
                            >
                                <div className="flex-grow flex items-end px-1">
                                    <span
                                        className={`text-sm text-gray-400${
                                            !!user && isSelected("user", user.id) ? " dark:text-gray-600" : ""
                                        }`}
                                    >
                                        Personal Account
                                    </span>
                                </div>
                            </SelectableCardSolid>
                        )}
                        {teamsAvailableForAttribution.map((t) => (
                            <SelectableCardSolid
                                className="h-18"
                                title={t.name}
                                selected={isSelected("team", t.id)}
                                onClick={() => setUsageAttributionTeam(t)}
                            >
                                <div className="flex-grow flex items-end px-1">
                                    <span
                                        className={`text-sm text-gray-400${
                                            isSelected("team", t.id) ? " dark:text-gray-600" : ""
                                        }`}
                                    >
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
