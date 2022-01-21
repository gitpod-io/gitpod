/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log, LogContext } from './logging';

export class SafePromise {
  public static catchAndLog<T>(p: Promise<T>, logCtx?: LogContext) {
    return SafePromise.catch(p, (err) => {
      if (logCtx) {
        log.error(logCtx, err);
      } else {
        log.error(err);
      }
    });
  }
  public static catch<T>(p: Promise<T>, handler: (err: any) => void): Promise<T> {
    return p.catch((err) => {
      handler(err);
      return {} as T; // Nobody will ever see this value as the Promise already failed. It's just there to please the compiler
    });
  }
}
