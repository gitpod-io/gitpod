/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";

type Props = {
    className?: string;
};
export const MiddleDot: FC<Props> = ({ className }) => {
    return <span className={className}>&nbsp;&middot;&nbsp;</span>;
};
