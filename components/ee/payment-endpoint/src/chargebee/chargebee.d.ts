/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

// Because the re-export of type definitions did not work the pure types are separated into chargebee-types.ts (export namespace Chargebee)
declare module 'chargebee' {
  export function configure(options: object): any;
  export const hosted_page: any;
  export const portal_session: any;
  export const subscription: any;
  export const gift: any;
  export const invoice: any;
  export const customer: any;
  export const coupon: any;
  export const payment_source: any;
}
