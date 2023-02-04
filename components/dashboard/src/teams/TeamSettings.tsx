/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Team } from "@gitpod/gitpod-protocol";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import React, { useCallback, useContext, useState } from "react";
import { Redirect } from "react-router";
import Alert from "../components/Alert";
import ConfirmationModal from "../components/ConfirmationModal";
import { teamsService } from "../service/public-api";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { useCurrentUser } from "../user-context";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { TeamsContext, useCurrentTeam, useIsOwnerOfCurrentTeam } from "./teams-context";

export function getTeamSettingsMenu(params: { team?: Team; billingMode?: BillingMode; ssoEnabled?: boolean }) {
    const { billingMode, ssoEnabled } = params;
    const result = [
        {
            title: "General",
            link: [`/settings`],
        },
    ];
    if (ssoEnabled) {
        result.push({
            title: "SSO",
            link: [`/sso`],
        });
    }
    if (billingMode?.mode !== "none") {
        // The Billing page contains both chargebee and usage-based components, so: always show them!
        result.push({
            title: "Billing",
            link: ["/billing"],
        });
    }
    return result;
}

export default function TeamSettings() {
    const user = useCurrentUser();
    const team = useCurrentTeam();
    const { teams, setTeams } = useContext(TeamsContext);
    const [modal, setModal] = useState(false);
    const [teamNameToDelete, setTeamNameToDelete] = useState("");
    const [teamName, setTeamName] = useState(team?.name || "");
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const isUserOwner = useIsOwnerOfCurrentTeam();
    const [updated, setUpdated] = useState(false);

    const close = () => setModal(false);

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
            setErrorMessage(`Failed to update organization information: ${error.message}`);
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
                setErrorMessage("Organization name can not be blank.");
                return;
            } else if (newName.trim().length > 32) {
                setErrorMessage("Organization name must not be longer than 32 characters.");
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
            <OrgSettingsPage>
                <h3>Organization Name</h3>
                <p className="text-base text-gray-500 max-w-2xl">
                    This is your organization's visible name within Gitpod. For example, the name of your company.
                </p>
                {errorMessage && (
                    <Alert type="error" closable={true} className="mb-2 max-w-xl rounded-md">
                        {errorMessage}
                    </Alert>
                )}
                {updated && (
                    <Alert type="message" closable={true} className="mb-2 max-w-xl rounded-md">
                        Organization name has been updated.
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
                        Update Organization Name
                    </button>
                </div>

                <h3 className="pt-12">Delete Organization</h3>
                <p className="text-base text-gray-500 pb-4 max-w-2xl">
                    Deleting this organization will also remove all associated data, including projects and workspaces.
                    Deleted organizations cannot be restored!
                </p>
                <button className="danger secondary" onClick={() => setModal(true)}>
                    Delete Organization
                </button>
            </OrgSettingsPage>

            <ConfirmationModal
                title="Delete Team"
                buttonText="Delete Team"
                buttonDisabled={teamNameToDelete !== team!.name}
                visible={modal}
                warningHead="Warning"
                warningText="This action cannot be reversed."
                onClose={close}
                onConfirm={deleteTeam}
            >
                <p className="text-base text-gray-500">
                    You are about to permanently delete <b>{team?.name}</b> including all associated data.
                </p>
                <ol className="text-gray-500 text-m list-outside list-decimal">
                    <li className="ml-5">
                        All <b>projects</b> added in this organization will be deleted and cannot be restored
                        afterwards.
                    </li>
                    <li className="ml-5">
                        All <b>members</b> of this organization will lose access to this organization, associated
                        projects and workspaces.
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
