/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceRegion } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { countries, continents } from "countries-list";

const NorthAmerica: WorkspaceRegion = "north-america";
const Europe: WorkspaceRegion = "europe";

export class RegionService {
    public static countryCodeToNearestWorkspaceRegion(code: string): WorkspaceRegion {
        if (!isCountryCode(code)) {
            return "";
        }

        const continent = countries[code].continent;

        if (!isContinentCode(continent)) {
            return "";
        }

        return nearestWorkspaceRegion[continent];
    }
}

export type CountryCode = keyof typeof countries;
export type ContinentCode = keyof typeof continents;

function isCountryCode(code: string): code is CountryCode {
    return code in countries;
}

function isContinentCode(code: string): code is ContinentCode {
    return code in continents;
}

const nearestWorkspaceRegion: { [continentCode in keyof typeof continents]: WorkspaceRegion } = {
    // Africa
    AF: Europe,
    // Antarctica
    AN: NorthAmerica,
    // Asia
    AS: NorthAmerica,
    // Europe
    EU: Europe,
    // North America
    NA: NorthAmerica,
    // Oceania
    OC: NorthAmerica,
    // South America
    SA: NorthAmerica,
};
