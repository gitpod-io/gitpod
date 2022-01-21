/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { hoursToMilliseconds } from '@gitpod/gitpod-protocol/lib/util/timeutil';

export namespace Accounting {
  /**
   * Issue a warning to the client when credit goes below this.
   */
  export const LOW_CREDIT_WARNINGS_IN_HOURS = [
    0,
    0.083333333333, // 5min
    0.166666666666, // 10min
    0.5, // 30min
  ];

  /**
   * Don't open new workspaces when credit is below this.
   */
  export const MINIMUM_CREDIT_FOR_OPEN_IN_HOURS = 0;

  /**
   * Allowed gap between last credit used up and new subscription start.
   */
  export const GOODWILL_IN_HOURS = 0.016666666666;
  export const GOODWILL_IN_MILLIS = hoursToMilliseconds(GOODWILL_IN_HOURS);

  export const FREE_SUBSCRIPTION_HOURS = 100;
}
