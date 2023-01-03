/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";

import UsageView from "./components/UsageView";
import { UserContext } from "./user-context";

function TeamUsage() {
    const { user } = useContext(UserContext);

    if (!user) {
        return <></>;
    }

    return <UsageView attributionId={{ kind: "user", userId: user.id }} />;
}

export default TeamUsage;
