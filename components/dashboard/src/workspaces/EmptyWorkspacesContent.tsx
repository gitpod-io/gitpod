/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { StartWorkspaceModalKeyBinding } from "../App";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { Heading2, Subheading } from "@podkit/typography/Headings";

export const EmptyWorkspacesContent = () => {
    return (
        <div className="app-container flex flex-col space-y-2">
            <div className="px-6 py-3 flex flex-col">
                <div className="flex flex-col items-center justify-center h-96 w-96 mx-auto">
                    <Heading2 className="text-center pb-3">No Workspaces</Heading2>
                    <Subheading className="text-center pb-6">
                        Prefix any Git repository URL with {window.location.host}/# or create a new workspace for a
                        recently used project.{" "}
                        <a
                            className="gp-link"
                            target="_blank"
                            rel="noreferrer"
                            href="https://www.gitpod.io/docs/getting-started/"
                        >
                            Learn more
                        </a>
                    </Subheading>
                    <span>
                        <LinkButton href={"/new"}>
                            New Workspace{" "}
                            <span className="opacity-60 hidden md:inline">{StartWorkspaceModalKeyBinding}</span>
                        </LinkButton>
                    </span>
                </div>
            </div>
        </div>
    );
};
