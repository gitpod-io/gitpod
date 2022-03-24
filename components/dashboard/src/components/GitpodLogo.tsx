/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// import React from "react";
import { useLabsStorage } from "../settings/LabsStorage";
import gitpodLogo from "../images/gitpod.svg";

const GitpodLogo = () => {
    const [store, _] = useLabsStorage();

    let logo;
    switch (store.makeIt) {
        default:
            logo = gitpodLogo;
            break;
    }

    return <img src={logo} className="h-6" alt="Gitpod's logo" />;
};
export default GitpodLogo;
