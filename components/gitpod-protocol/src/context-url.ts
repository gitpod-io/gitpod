/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export namespace ContextURL {
  export const INCREMENTAL_PREBUILD_PREFIX = "incremental-prebuild";
  export const PREBUILD_PREFIX = "prebuild";
  export const IMAGEBUILD_PREFIX = "imagebuild";
  export const REFERRER_PREFIX = 'referrer:';

  /**
   * The field "contextUrl" might contain prefixes like:
   *  - envvar1=value1/...
   *  - prebuild/...
   * This is the analogon to the (Prefix)ContextParser structure in "server".
   */
  export function parseToURL(contextUrl: string | undefined): URL | undefined {
    if (contextUrl === undefined) {
      return undefined;
    }

    const segments = contextUrl.split("/");
    if (segments.length === 1) {
      return new URL(segments[0]);  // this might be something, we just try
    }

    const segmentsToURL = (offset: number): URL => {
      let rest = segments.slice(offset).join("/");
      if (!rest.startsWith("http")) {
        rest = 'https://' + rest;
      }
      return new URL(rest);
    };


    const firstSegment = segments[0];
    if (firstSegment === PREBUILD_PREFIX ||
        firstSegment === INCREMENTAL_PREBUILD_PREFIX ||
        firstSegment === IMAGEBUILD_PREFIX ||
        firstSegment.startsWith(REFERRER_PREFIX)) {
      return segmentsToURL(1);
    }

    // check for env vars
    if (firstSegment.indexOf("=") !== -1) {
      return segmentsToURL(1);
    }

    return segmentsToURL(0);
  }
}