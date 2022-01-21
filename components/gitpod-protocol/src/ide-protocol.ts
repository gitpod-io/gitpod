/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * `IDEServer` provides a list of available IDEs.
 */
export interface IDEServer {
  /**
   * Returns the IDE preferences.
   */
  getIDEOptions(): Promise<IDEOptions>;
}

export interface IDEOptions {
  /**
   * A list of available IDEs.
   */
  options: { [key: string]: IDEOption };

  /**
   * The default (browser) IDE when the user has not specified one.
   */
  defaultIde: string;

  /**
   * The default desktop IDE when the user has not specified one.
   */
  defaultDesktopIde: string;
}

export interface IDEOption {
  /**
   * To ensure a stable order one can set an `orderKey`.
   */
  orderKey?: string;

  /**
   * Human readable title text of the IDE (plain text only).
   */
  title: string;

  /**
   * The type of the IDE, currently 'browser' or 'desktop'.
   */
  type: 'browser' | 'desktop';

  /**
   * The logo for the IDE. That could be a key in (see
   * components/dashboard/src/images/ideLogos.ts) or a URL.
   */
  logo: string;

  /**
   * Text of an optional tooltip (plain text only).
   */
  tooltip?: string;

  /**
   * Text of an optional label next to the IDE option like “Insiders” (plain
   * text only).
   */
  label?: string;

  /**
   * Notes to the IDE option that are renderd in the preferences when a user
   * chooses this IDE.
   */
  notes?: string[];

  /**
   * If `true` this IDE option is not visible in the IDE preferences.
   */
  hidden?: boolean;

  /**
   * The image ref to the IDE image.
   */
  image: string;

  /**
   * When this is `true`, the tag of this image is resolved to the latest
   * image digest regularly.
   *
   * This is useful if this image points to a tag like `nightly` that will be
   * updated regularly. When `resolveImageDigest` is `true`, we make sure that
   * we resolve the tag regularly to the most recent image version.
   */
  resolveImageDigest?: boolean;
}
