/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from '@gitpod/gitpod-protocol';
import { WhatsNewEntry } from './WhatsNew';
import { switchToVSCodeAction } from './WhatsNew-2021-04';
import CodeText from '../components/CodeText';
import PillLabel from '../components/PillLabel';

export const WhatsNewEntry202106: WhatsNewEntry = {
  children: (user: User, setUser: React.Dispatch<User>) => {
    return (
      <>
        <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 pt-6 pb-4">
          <p className="pb-2 text-gray-900 dark:text-gray-100 text-base font-medium">
            Exposing Ports <PillLabel>Configuration Update</PillLabel>
          </p>
          <p className="pb-2 text-gray-500 dark:text-gray-400 text-sm">
            We've changed the default behavior of exposed ports to improve the security of your dev environments.
          </p>
          <p className="pb-2 text-gray-500 dark:text-gray-400 text-sm">
            Exposing ports are now private by default. You can still change port visibility through the editor or even
            configure this with the <CodeText>visibility</CodeText> property in <CodeText>.gitpod.yml</CodeText>.
          </p>
        </div>
        {user.additionalData?.ideSettings?.defaultIde !== 'code' && (
          <>
            <div className="border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 pt-6 pb-4">
              <p className="pb-2 text-gray-900 dark:text-gray-100 text-base font-medium">
                New Editor <PillLabel type="warn">Deprecation Warning</PillLabel>
              </p>
              <p className="pb-2 text-gray-500 dark:text-gray-400 text-sm">
                We're deprecating the Theia editor. You can still switch back to Theia for the next few weeks but the
                preference will be removed by the end of August 2021.
              </p>
            </div>
          </>
        )}
      </>
    );
  },
  newsKey: 'June-2021',
  maxUserCreationDate: '2021-07-01',
  actionAfterSeen: switchToVSCodeAction,
};
