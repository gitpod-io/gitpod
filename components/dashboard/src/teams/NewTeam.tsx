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
import { Button } from "@podkit/buttons/Button";
import { TextInputField } from "../components/forms/TextInputField";
import { cn } from "@podkit/lib/cn";

export default function NewTeamPage() {
    useDocumentTitle("New Organization");

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

    return (
        <div className="flex flex-col w-96 mt-24 mx-auto items-center">
            <Heading1>New&nbsp;Organization</Heading1>
            <Subheading className="text-center">
                <a href="https://www.gitpod.io/docs/configure/teams" className="gp-link">
                    Organizations
                </a>{" "}
                allow you to manage related{" "}
                <a href="https://www.gitpod.io/docs/configure/repositories" className="gp-link">
                    repositories
                </a>{" "}
                and collaborate with other members.
            </Subheading>
            <form className="mt-6 mb-4" onSubmit={createTeam}>
                <div className="rounded-xl p-6 bg-pk-surface-secondary">
                    <Heading3>You're creating a new organization</Heading3>
                    <Subheading>After creating an organization, you can invite others to join.</Subheading>

                    <TextInputField
                        label="Organization Name"
                        value={name}
                        autoFocus
                        className={cn("w-full", { error: !!creationError })}
                        onChange={setName}
                    />
                    {!!creationError && (
                        <p className="text-gitpod-red">
                            {creationError.message.replace(/Request \w+ failed with message: /, "")}
                        </p>
                    )}
                </div>
                <div className="flex flex-row-reverse space-x-2 space-x-reverse mt-2">
                    <Button type="submit">Create Organization</Button>
                    <Button variant="secondary" onClick={() => history.push("/")}>
                        Cancel
                    </Button>
                </div>
            </form>
        </div>
    );
}
