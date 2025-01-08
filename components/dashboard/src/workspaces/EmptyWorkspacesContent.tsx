/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LinkButton } from "@podkit/buttons/LinkButton";
import { Heading2, Subheading } from "@podkit/typography/Headings";
import { StartWorkspaceModalKeyBinding } from "../App";

export const EmptyWorkspacesContent = () => {
    return (
        <div className="app-container flex flex-col space-y-2">
            <div className="px-6 mt-16 flex flex-col xl:flex-row items-center justify-center gap-x-14 gap-y-10 min-h-96 min-w-96">
                <div className="flex flex-col items-center text-center justify-center">
                    <Heading2 className="!font-semibold !text-lg">No workspaces</Heading2>
                    <Subheading className="max-w-xs xl:text-left text-center">
                        Create a new workspace to start coding
                    </Subheading>
                    <div className="flex flex-col mt-4 w-fit">
                        <LinkButton href={"/new"} className="gap-1.5">
                            New Workspace{" "}
                            <span className="opacity-60 hidden md:inline">{StartWorkspaceModalKeyBinding}</span>
                        </LinkButton>
                    </div>
                </div>
            </div>
        </div>
    );
};
