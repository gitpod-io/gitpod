/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import exclamation from '../images/exclamation.svg';

export default function AlertBox(p: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={'flex rounded-xl bg-gitpod-kumquat-light text-gitpod-red p-4 ' + (p.className || '')}>
      <img className="w-4 h-4 m-1 ml-2 mr-4" src={exclamation} />
      <span>{p.children}</span>
    </div>
  );
}
