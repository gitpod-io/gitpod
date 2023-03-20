/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useCallback, useState } from "react";
import Alert from "../components/Alert";
import ConfirmationModal from "../components/ConfirmationModal";
import { Heading2, Subheading } from "../components/typography/headings";
import { useCurrentOrg, useOrganizationsInvalidator } from "../data/organizations/orgs-query";
import { teamsService } from "../service/public-api";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { useCurrentUser } from "../user-context";
import { OrgSettingsPage } from "./OrgSettingsPage";

export default function TeamSettings() {
    const user = useCurrentUser();
    const org = useCurrentOrg().data;
    const invalidateOrgs = useOrganizationsInvalidator();
    const [modal, setModal] = useState(false);
    const [teamNameToDelete, setTeamNameToDelete] = useState("");
    const [teamName, setTeamName] = useState(org?.name || "");
    const [slug, setSlug] = useState(org?.slug || "");
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
    const [updated, setUpdated] = useState(false);

    const close = () => setModal(false);

    const updateTeamInformation = useCallback(async () => {
        if (!org || errorMessage) {
            return;
        }
        try {
            await getGitpodService().server.updateTeam(org.id, { name: teamName, slug });
            invalidateOrgs();
            setUpdated(true);
            setTimeout(() => setUpdated(false), 3000);
        } catch (error) {
            setErrorMessage(`Failed to update organization information: ${error.message}`);
        }
    }, [org, errorMessage, slug, teamName, invalidateOrgs]);

    const onNameChange = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            if (!org) {
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
        [org],
    );

    const onSlugChange = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            if (!org) {
                return;
            }
            const newSlug = event.target.value || "";
            setSlug(newSlug);
            if (newSlug.trim().length === 0) {
                setErrorMessage("Organization slug can not be blank.");
                return;
            } else if (newSlug.trim().length > 100) {
                setErrorMessage("Organization slug must not be longer than 100 characters.");
                return;
            } else {
                setErrorMessage(undefined);
            }
        },
        [org],
    );

    const deleteTeam = useCallback(async () => {
        if (!org || !user) {
            return;
        }

        await teamsService.deleteTeam({ teamId: org.id });
        invalidateOrgs();
        document.location.href = gitpodHostUrl.asDashboard().toString();
    }, [invalidateOrgs, org, user]);

    return (
        <>
            <OrgSettingsPage>
                <Heading2>Organization Name</Heading2>
                <Subheading className="max-w-2xl">
                    This is your organization's visible name within Gitpod. For example, the name of your company.
                </Subheading>
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
                <div className="flex flex-col lg:flex-row">
                    <div>
                        <div className="mt-4 mb-3">
                            <h4>Slug</h4>
                            <input type="text" value={slug} onChange={onSlugChange} />
                        </div>
                    </div>
                </div>
                <div className="flex flex-row">
                    <button
                        className="primary"
                        disabled={(org?.name === teamName && org?.slug === slug) || !!errorMessage}
                        onClick={updateTeamInformation}
                    >
                        Update Organization Name
                    </button>
                </div>

                <Heading2 className="pt-12">Delete Organization</Heading2>
                <Subheading className="pb-4 max-w-2xl">
                    Deleting this organization will also remove all associated data, including projects and workspaces.
                    Deleted organizations cannot be restored!
                </Subheading>
                <button className="danger secondary" onClick={() => setModal(true)}>
                    Delete Organization
                </button>
            </OrgSettingsPage>

            <ConfirmationModal
                title="Delete Team"
                buttonText="Delete Team"
                buttonDisabled={teamNameToDelete !== org?.name}
                visible={modal}
                warningHead="Warning"
                warningText="This action cannot be reversed."
                onClose={close}
                onConfirm={deleteTeam}
            >
                <p className="text-base text-gray-500">
                    You are about to permanently delete <b>{org?.name}</b> including all associated data.
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
                    Type <code>{org?.name}</code> to confirm
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
