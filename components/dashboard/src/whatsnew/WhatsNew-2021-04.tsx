/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from '@gitpod/gitpod-protocol';
import { getGitpodService } from '../service/service';
import { WhatsNewEntry } from './WhatsNew';

export const switchToVSCodeAction = async (user: User) => {
  const additionalData = (user.additionalData = user.additionalData || {});
  // make sure code is set as the editor preference
  const ideSettings = (additionalData.ideSettings = additionalData.ideSettings || {});
  ideSettings.defaultIde = 'code';
  user = await getGitpodService().server.updateLoggedInUser({
    additionalData,
  });
  return user;
};

export const WhatsNewEntry202104: WhatsNewEntry = {
  newsKey: 'April-2021',
  maxUserCreationDate: '2021-04-08',
  children: () => (
    <>
      <div className="border-t border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4">
        <p className="pb-2 text-gray-900 dark:text-gray-100 text-base font-medium">New Dashboard</p>
        <p className="pb-2 text-gray-500 dark:text-gray-400 text-sm">
          We have made some layout changes on the dashboard to improve the overall user experience of Gitpod.
        </p>
      </div>
      <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4">
        <p className="pb-2 text-gray-900 dark:text-gray-100 text-base font-medium">VS Code</p>
        <p className="pb-4 text-gray-500 dark:text-gray-400 text-sm">We are changing the default IDE to VS Code.</p>
        <ol className="pb-2 text-gray-500 dark:text-gray-400 text-sm list-outside list-decimal space-y-2">
          <li className="ml-5">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                We're preserving most <span className="font-bold">user settings and extensions</span>.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                Extensions you have manually uploaded are not transferred. You'll need to search and install those
                extensions through the extension panel in VS Code.
              </p>
            </div>
          </li>
          <li className="ml-5">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                We've reduced the number of <span className="font-bold">pre-installed extensions</span>.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                The Theia-based editor included pre-installed extensions for the most popular programming languages
                which was convenient for starters but added additional bloat. You can now install any extensions you
                need and leave out those you don't.
              </p>
            </div>
          </li>
          <li className="ml-5">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                You can still <span className="font-bold">switch the IDE</span> back to Theia.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                In case you run into trouble with VS Code, you can go to the settings and switch back to the Theia.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </>
  ),
  actionAfterSeen: switchToVSCodeAction,
};
