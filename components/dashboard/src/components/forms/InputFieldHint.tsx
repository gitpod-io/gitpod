/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";

export const InputFieldHint: FC = ({ children }) => {
    return <span className="text-gray-500 dark:text-gray-400 text-sm">{children}</span>;
};
