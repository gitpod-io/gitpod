/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Subheading } from "../../components/typography/headings";

export const NewProjectSubheading: FC = () => {
    return (
        <Subheading className="text-center">
            Projects allow you to manage prebuilds and workspaces for your repository.{" "}
            <a
                href="https://www.gitpod.io/docs/configure/projects"
                target="_blank"
                rel="noreferrer"
                className="gp-link"
            >
                Learn more
            </a>
        </Subheading>
    );
};
