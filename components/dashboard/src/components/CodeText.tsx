/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export default function CodeText(p: { children?: React.ReactNode }) {
  return (
    <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md text-sm font-mono font-medium">
      {p.children}
    </span>
  );
}
