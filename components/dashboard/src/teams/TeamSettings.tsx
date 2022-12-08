/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Team } from "@gitpod/gitpod-protocol";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { useContext, useEffect, useState } from "react";
import { Redirect, useLocation } from "react-router";
import ConfirmationModal from "../components/ConfirmationModal";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { publicApiTeamMembersToProtocol, teamsService } from "../service/public-api";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import { getCurrentTeam, TeamsContext } from "./teams-context";

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
    const [modal, setModal] = useState(false);
    const [teamSlug, setTeamSlug] = useState("");
    const [isUserOwner, setIsUserOwner] = useState(true);
    const { teams } = useContext(TeamsContext);
    const { user } = useContext(UserContext);
    const { usePublicApiTeamsService } = useContext(FeatureFlagContext);
    const [billingMode, setBillingMode] = useState<BillingMode | undefined>(undefined);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);

    const close = () => setModal(false);

    useEffect(() => {
        (async () => {
            if (!team) return;
            const members = usePublicApiTeamsService
                ? await publicApiTeamMembersToProtocol(
                      (await teamsService.getTeam({ teamId: team!.id })).team?.members || [],
                  )
                : await getGitpodService().server.getTeamMembers(team.id);

            const currentUserInTeam = members.find((member) => member.userId === user?.id);
            setIsUserOwner(currentUserInTeam?.role === "owner");

            // TODO(gpl) Maybe we should have TeamContext here instead of repeating ourselves...
            const billingMode = await getGitpodService().server.getBillingModeForTeam(team.id);
            setBillingMode(billingMode);
        })();
    }, []);

    if (!isUserOwner) {
        return <Redirect to="/" />;
    }
    const deleteTeam = async () => {
        if (!team || !user) {
            return;
        }

        usePublicApiTeamsService
            ? await teamsService.deleteTeam({ teamId: team.id })
            : await getGitpodService().server.deleteTeam(team.id);

        document.location.href = gitpodHostUrl.asDashboard().toString();
    };

    return (
        <>
            <PageWithSubMenu
                subMenu={getTeamSettingsMenu({ team, billingMode })}
                title="Settings"
                subtitle="Manage general team settings."
            >
                <h3>Delete Team</h3>
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
                buttonDisabled={teamSlug !== team!.slug}
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
                    Type <code>{team?.slug}</code> to confirm
                </p>
                <input autoFocus className="w-full" type="text" onChange={(e) => setTeamSlug(e.target.value)}></input>
            </ConfirmationModal>
        </>
    );
}
