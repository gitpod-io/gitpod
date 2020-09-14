/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


export interface LicenseValidationResult {
    valid: boolean
    msg?: string
    issue?: LicenseIssue
}

export type LicenseIssue = "seats-exhausted";

export interface LicenseInfo {
    key: string;
    seats: number;
    valid: boolean;
    validUntil: string;
    plan?: string;
}

export interface GetLicenseInfoResult {
    isAdmin: boolean;
    licenseInfo: LicenseInfo;
}

export enum LicenseFeature {
    CreateSnapshot = "create-snapshot",
    // room for more
}

export interface LicenseService {
    validateLicense(params: LicenseService.ValidateLicenseParams): Promise<LicenseValidationResult>;
    getLicenseInfo(params: LicenseService.GetLicenseInfoParams): Promise<GetLicenseInfoResult>;
    licenseIncludesFeature(params: LicenseService.LicenseIncludesFeatureParams): Promise<boolean>
}

export namespace LicenseService {
    export interface ValidateLicenseParams {}
    export interface GetLicenseInfoParams {}
    export interface LicenseIncludesFeatureParams {
        readonly feature: LicenseFeature;
    }
}