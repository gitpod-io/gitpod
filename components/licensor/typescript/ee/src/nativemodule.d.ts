/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */


export type Instance = number;

export function init(key: string, domain: string): Instance;
export function validate(id: Instance): { msg: string, valid: boolean };
export function isEnabled(id: Instance, feature: Feature, seats: int): boolean;
export function hasEnoughSeats(id: Instance, seats: int): boolean;
export function inspect(id: Instance): string;
export function dispose(id: Instance);
export function getLicenseData(id: Instance): string;
