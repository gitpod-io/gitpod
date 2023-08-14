/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import type { orbital } from "@useorbital/client-types/types";
import { useFeatureFlag } from "../data/featureflag-query";

declare global {
    interface Window {
        orbital: orbital;
    }
}

export const useOrbital = (spaceId: string) => {
    const [isLoaded, setIsLoaded] = useState<boolean>(false);
    const [discoveryIds, setDiscoveryIds] = useState<Set<string>>(new Set());

    const enabledOrbitalDiscoveries = useFeatureFlag("enabledOrbitalDiscoveries");

    useEffect(() => {
        if (document.getElementById("orbital-client")) return;
        if (discoveryIds.size === 0) return;

        const body = document.getElementsByTagName("body")[0];

        const installationScript = document.createElement("script");
        installationScript.innerHTML = `(function(o,r,b,i,t,a,l){o[r]||(t=o[r]=function(){i.push(arguments)},t._t=new Date,t._v=1,i=t._q=[])})(window,'orbital');`;
        body.appendChild(installationScript);

        const orbitalScript = document.createElement("script");
        orbitalScript.setAttribute("id", "orbital-client");
        orbitalScript.setAttribute("src", `https://client.useorbital.com/api/account/${spaceId}/client.js`);
        orbitalScript.setAttribute("async", "");
        body.appendChild(orbitalScript);
        orbitalScript.addEventListener(
            "load",
            () => {
                if (typeof window["orbital"] === "undefined") {
                    console.error("Orbital script failed to load.");
                    return;
                }
                setIsLoaded(true);
            },
            { once: true, capture: false },
        );
    }, [discoveryIds.size, spaceId]);

    useEffect(() => {
        console.debug(enabledOrbitalDiscoveries);
        if (!enabledOrbitalDiscoveries || enabledOrbitalDiscoveries === true) return;
        setDiscoveryIds(new Set(enabledOrbitalDiscoveries.split(",").filter((value) => !!value)));
    }, [enabledOrbitalDiscoveries]);

    return {
        isLoaded,
        discoveryIds,
        orbital: window["orbital"],
    };
};
