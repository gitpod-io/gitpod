/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";

type Props = {
    className?: string;
    children: string;
};
export const RepositoryURL: FC<Props> = ({ className, children }) => {
    const cleanURL = children.endsWith(".git") ? children.slice(0, -4) : children;

    return <span className={className}>{cleanURL}</span>;
};
