/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Team } from "@gitpod/gitpod-protocol";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { Redirect } from "react-router";
import Alert from "../components/Alert";
import ConfirmationModal from "../components/ConfirmationModal";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { publicApiTeamMembersToProtocol, teamsService } from "../service/public-api";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { useCurrentUser } from "../user-context";
import { TeamsContext, useCurrentTeam } from "./teams-context";

export function getTeamSettingsMenu(params: { team?: Team; billingMode?: BillingMode }) {
    const { team, billingMode } = params;
    return [
        {
            title: "General",
            link: [`/t/${team?.slug}/settings`],
        },
        // The Billing page contains both chargebee and usage-based components, so: always show them!
        ...(billingMode && billingMode.mode !== "none"
            ? [
                  {
                      title: "Billing",
                      link: [`/t/${team?.slug}/billing`],
                  },
              ]
            : []),
    ];
}

export default function TeamSettings() {
    const user = useCurrentUser();
    const team = useCurrentTeam();
    const { teams, setTeams } = useContext(TeamsContext);
    const [modal, setModal] = useState(false);
    const [teamNameToDelete, setTeamNameToDelete] = useState("");
    const [teamName, setTeamName] = useState(team?.name || "");
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [isUserOwner, setIsUserOwner] = useState(true);
    const [billingMode, setBillingMode] = useState<BillingMode | undefined>(undefined);
    const [updated, setUpdated] = useState(false);

    const close = () => setModal(false);

    useEffect(() => {
        (async () => {
            if (!team) return;
            const members = publicApiTeamMembersToProtocol(
                (await teamsService.getTeam({ teamId: team!.id })).team?.members || [],
            );

            const currentUserInTeam = members.find((member) => member.userId === user?.id);
            setIsUserOwner(currentUserInTeam?.role === "owner");

            // TODO(gpl) Maybe we should have TeamContext here instead of repeating ourselves...
            const billingMode = await getGitpodService().server.getBillingModeForTeam(team.id);
            setBillingMode(billingMode);
        })();
    }, [team, user]);

    const updateTeamInformation = useCallback(async () => {
        if (!team || errorMessage || !teams) {
            return;
        }
        try {
            const updatedTeam = await getGitpodService().server.updateTeam(team.id, { name: teamName });
            const updatedTeams = [...teams?.filter((t) => t.id !== team.id)];
            updatedTeams.push(updatedTeam);
            setTeams(updatedTeams);
            setUpdated(true);
            setTimeout(() => setUpdated(false), 3000);
        } catch (error) {
            setErrorMessage(`Failed to update team information: ${error.message}`);
        }
    }, [team, errorMessage, teams, teamName, setTeams]);

    const onNameChange = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            if (!team) {
                return;
            }
            const newName = event.target.value || "";
            setTeamName(newName);
            if (newName.trim().length === 0) {
                setErrorMessage("Team name can not be blank.");
                return;
            } else if (newName.trim().length > 32) {
                setErrorMessage("Team name must not be longer than 32 characters.");
                return;
            } else {
                setErrorMessage(undefined);
            }
        },
        [team],
    );

    const deleteTeam = useCallback(async () => {
        if (!team || !user) {
            return;
        }

        await teamsService.deleteTeam({ teamId: team.id });

        document.location.href = gitpodHostUrl.asDashboard().toString();
    }, [team, user]);

    if (!isUserOwner) {
        return <Redirect to="/" />;
    }

    return (
        <>
            <PageWithSubMenu
                subMenu={getTeamSettingsMenu({ team, billingMode })}
                title="Settings"
                subtitle="Manage general team settings."
            >
                <h3>Team Name</h3>
                <p className="text-base text-gray-500 max-w-2xl">
                    This is your team's visible name within Gitpod. For example, the name of your company.
                </p>
                {errorMessage && (
                    <Alert type="error" closable={true} className="mb-2 max-w-xl rounded-md">
                        {errorMessage}
                    </Alert>
                )}
                {updated && (
                    <Alert type="message" closable={true} className="mb-2 max-w-xl rounded-md">
                        Team name has been updated.
                    </Alert>
                )}
                <div className="flex flex-col lg:flex-row">
                    <div>
                        <div className="mt-4 mb-3">
                            <h4>Name</h4>
                            <input type="text" value={teamName} onChange={onNameChange} />
                        </div>
                    </div>
                </div>
                <div className="flex flex-row">
                    <button
                        className="primary"
                        disabled={team?.name === teamName || !!errorMessage}
                        onClick={updateTeamInformation}
                    >
                        Update Team Name
                    </button>
                </div>

                <h3 className="pt-12">Delete Team</h3>
                <p className="text-base text-gray-500 pb-4 max-w-2xl">
                    Deleting this team will also remove all associated data with this team, including projects and
                    workspaces. Deleted teams cannot be restored!
                </p>
                <button className="danger secondary" onClick={() => setModal(true)}>
                    Delete Team
                </button>
            </PageWithSubMenu>

            <ConfirmationModal
                title="Delete Team"
                buttonText="Delete Team"
                buttonDisabled={teamNameToDelete !== team!.name}
                visible={modal}
                warningText="Warning: This action cannot be reversed."
                onClose={close}
                onConfirm={deleteTeam}
            >
                <p className="text-base text-gray-500">
                    You are about to permanently delete <b>{team?.slug}</b> including all associated data with this
                    team.
                </p>
                <ol className="text-gray-500 text-m list-outside list-decimal">
                    <li className="ml-5">
                        All <b>projects</b> added in this team will be deleted and cannot be restored afterwards.
                    </li>
                    <li className="ml-5">
                        All <b>members</b> of this team will lose access to this team, associated projects and
                        workspaces.
                    </li>
                </ol>
                <p className="pt-4 pb-2 text-gray-600 dark:text-gray-400 text-base font-semibold">
                    Type <code>{team?.name}</code> to confirm
                </p>
                <input
                    autoFocus
                    className="w-full"
                    type="text"
                    onChange={(e) => setTeamNameToDelete(e.target.value)}
                ></input>
            </ConfirmationModal>
        </>
    );
}
