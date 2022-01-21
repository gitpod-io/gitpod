/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Team } from '@gitpod/gitpod-protocol';
import { useContext, useEffect, useState } from 'react';
import { Redirect, useLocation } from 'react-router';
import CodeText from '../components/CodeText';
import ConfirmationModal from '../components/ConfirmationModal';
import { PageWithSubMenu } from '../components/PageWithSubMenu';
import { getGitpodService, gitpodHostUrl } from '../service/service';
import { UserContext } from '../user-context';
import { getCurrentTeam, TeamsContext } from './teams-context';

export function getTeamSettingsMenu(team?: Team) {
  return [
    {
      title: 'General',
      link: [`/t/${team?.slug}/settings`],
    },
  ];
}

export default function TeamSettings() {
  const [modal, setModal] = useState(false);
  const [teamSlug, setTeamSlug] = useState('');
  const [isUserOwner, setIsUserOwner] = useState(true);
  const { teams } = useContext(TeamsContext);
  const { user } = useContext(UserContext);
  const location = useLocation();
  const team = getCurrentTeam(location, teams);

  const close = () => setModal(false);

  useEffect(() => {
    (async () => {
      if (!team) return;
      const members = await getGitpodService().server.getTeamMembers(team.id);
      const currentUserInTeam = members.find((member) => member.userId === user?.id);
      setIsUserOwner(currentUserInTeam?.role === 'owner');
    })();
  }, []);

  if (!isUserOwner) {
    return <Redirect to="/" />;
  }
  const deleteTeam = async () => {
    if (!team || !user) {
      return;
    }
    await getGitpodService().server.deleteTeam(team.id, user.id);
    document.location.href = gitpodHostUrl.asDashboard().toString();
  };

  return (
    <>
      <PageWithSubMenu subMenu={getTeamSettingsMenu(team)} title="Settings" subtitle="Manage general team settings.">
        <h3>Delete Team</h3>
        <p className="text-base text-gray-500 pb-4 max-w-2xl">
          Deleting this team will also remove all associated data with this team, including projects and workspaces.
          Deleted teams cannot be restored!
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
          You are about to permanently delete <b>{team?.slug}</b> including all associated data with this team.
        </p>
        <ol className="text-gray-500 text-m list-outside list-decimal">
          <li className="ml-5">
            All <b>projects</b> added in this team will be deleted and cannot be restored afterwards.
          </li>
          <li className="ml-5">
            All <b>workspaces</b> opened for projects within this team will be deleted for all team members and cannot
            be restored afterwards.
          </li>
          <li className="ml-5">
            All <b>members</b> of this team will lose access to this team, associated projects and workspaces.
          </li>
        </ol>
        <p className="pt-4 pb-2 text-gray-600 dark:text-gray-400 text-base font-semibold">
          Type <CodeText>{team?.slug}</CodeText> to confirm
        </p>
        <input autoFocus className="w-full" type="text" onChange={(e) => setTeamSlug(e.target.value)}></input>
      </ConfirmationModal>
    </>
  );
}
