/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { countries, continents } from "countries-list";

const NorthAmerica = "north-america";
const Europe = "europe";
const Unknown = "unknown";

type WorkspaceRegion = "europe" | "north-america" | "unknown";

export class RegionService {
    public static countryCodeToNearestWorkspaceRegion(code: string): WorkspaceRegion {
        if (!isCountryCode(code)) {
            return Unknown;
        }

        const continent = countries[code].continent;

        if (!isContinentCode(continent)) {
            return Unknown;
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
