/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// import React from "react";
import { useLabsStorage } from "../settings/LabsStorage";
// import gitpodLogo from "../icons/gitpod.svg";
// import classicLogo from "../icons/gitpod-classic.svg";
// import prideLogo from "../icons/pride.svg";
// import queenLogo from "../icons/queen.png";
// import pawquatLogo from "../icons/pawquat.png";
// import animeLogo from "../icons/anime.png";
// import aussieLogo from "../icons/bunnings.png";
// import whitelabelLogo from "../icons/whitelabel.jpg";

const GitpodLogo = () => {
    const [store, _] = useLabsStorage();

    let logo;
    switch (store.makeIt) {
        // case "classic":
        //     logo = classicLogo;
        //     break;
        // case "gay":
        //     logo = prideLogo;
        //     break;
        // case "british":
        //     logo = queenLogo;
        //     break;
        // case "pawquat":
        //     logo = pawquatLogo;
        //     break;
        // case "anime":
        //     logo = animeLogo;
        //     break;
        // case "aussie":
        //     logo = aussieLogo;
        //     break;
        // // case "whitelabel":
        // //     logo = whitelabelLogo;
        // //     break;
        default:
            logo = "https://example.com";
            break;
    }

    return <img src={logo} className={Object.is(logo, "https://example.com") ? "h-6" : "h-12"} alt="Gitpod's logo" />;
};
export default GitpodLogo;
