/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ConnectError } from "@connectrpc/connect";
import { FormEvent, useState } from "react";
import { useHistory } from "react-router-dom";
import { Heading1, Heading3, Subheading } from "../components/typography/headings";
import { useOrganizationsInvalidator } from "../data/organizations/orgs-query";
import { useDocumentTitle } from "../hooks/use-document-title";
import { organizationClient } from "../service/public-api";
import { Button } from "../components/Button";
import { TextInputField } from "../components/forms/TextInputField";

export default function NewTeamPage() {
    const invalidateOrgs = useOrganizationsInvalidator();
    const [name, setName] = useState("");

    const history = useHistory();

    const [creationError, setCreationError] = useState<Error>();
    const createTeam = async (event: FormEvent) => {
        event.preventDefault();

        try {
            const team = await organizationClient.createOrganization({ name });
            invalidateOrgs();
            // Redirects to the new Org's dashboard
            history.push(`/workspaces/?org=${team.organization?.id}`);
        } catch (error) {
            console.error(error);
            if (error instanceof ConnectError) {
                setCreationError(new Error(error.rawMessage));
            } else {
                setCreationError(error);
            }
        }
    };

    useDocumentTitle("New Organization");

    return (
        <div className="flex flex-col w-96 mt-24 mx-auto items-center">
            <Heading1>New&nbsp;Organization</Heading1>
            <Subheading className="text-center">
                <a href="https://www.gitpod.io/docs/configure/teams" className="gp-link">
                    Organizations
                </a>{" "}
                allow you to manage related{" "}
                <a href="https://www.gitpod.io/docs/configure/projects" className="gp-link">
                    projects
                </a>{" "}
                and collaborate with other members.
            </Subheading>
            <form className="mt-16" onSubmit={createTeam}>
                <div className="rounded-xl p-6 bg-gray-50 dark:bg-gray-800">
                    <Heading3>You're creating a new organization</Heading3>
                    <Subheading>After creating an organization, you can invite others to join.</Subheading>

                    <TextInputField
                        label="Organization Name"
                        value={name}
                        autoFocus
                        className={`w-full${!!creationError ? " error" : ""}`}
                        onChange={setName}
                    />
                    {!!creationError && (
                        <p className="text-gitpod-red">
                            {creationError.message.replace(/Request \w+ failed with message: /, "")}
                        </p>
                    )}
                </div>
                <div className="flex flex-row-reverse space-x-2 space-x-reverse mt-2">
                    <Button htmlType="submit">Create Organization</Button>
                    <Button type="secondary" onClick={() => history.push("/")}>
                        Cancel
                    </Button>
                </div>
            </form>
        </div>
    );
}
