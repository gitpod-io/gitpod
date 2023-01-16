/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FormEvent, useContext, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { TeamsContext } from "./teams-context";
import { teamsService } from "../service/public-api";
import { ConnectError } from "@bufbuild/connect-web";

export default function () {
    const { setTeams } = useContext(TeamsContext);

    const history = useHistory();

    const [creationError, setCreationError] = useState<Error>();
    let name = "";
    const createTeam = async (event: FormEvent) => {
        event.preventDefault();

        try {
            const team = (await teamsService.createTeam({ name })).team!;

            const teams = (await teamsService.listTeams({})).teams;

            setTeams(teams);
            history.push(`/t/${team.slug}`);
        } catch (error) {
            console.error(error);
            if (error instanceof ConnectError) {
                setCreationError(new Error(error.rawMessage));
            } else {
                setCreationError(error);
            }
        }
    };

    useEffect(() => {
        document.title = "New Team — Gitpod";
    }, []);

    return (
        <div className="flex flex-col w-96 mt-24 mx-auto items-center">
            <h1>New Team</h1>
            <p className="text-gray-500 text-center text-base">
                <a href="https://www.gitpod.io/docs/configure/teams" className="gp-link">
                    Teams
                </a>{" "}
                allow you to manage related{" "}
                <a href="https://www.gitpod.io/docs/configure/projects" className="gp-link">
                    projects
                </a>{" "}
                and collaborate with other members.
            </p>
            <form className="mt-16 w-full" onSubmit={createTeam}>
                <div className="rounded-xl p-6 bg-gray-50 dark:bg-gray-800">
                    <h3 className="text-left text-lg">You're creating a new team</h3>
                    <p className="text-gray-500">After creating a team, you can invite others to join.</p>
                    <br />
                    <h4>Team Name</h4>
                    <input
                        autoFocus
                        className={`w-full${!!creationError ? " error" : ""}`}
                        type="text"
                        onChange={(event) => (name = event.target.value)}
                    />
                    {!!creationError && (
                        <p className="text-gitpod-red">
                            {creationError.message.replace(/Request \w+ failed with message: /, "")}
                        </p>
                    )}
                </div>
                <div className="flex flex-row-reverse space-x-2 space-x-reverse mt-2">
                    <button type="submit">Create Team</button>
                    <button className="secondary" onClick={() => history.push("/")}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
