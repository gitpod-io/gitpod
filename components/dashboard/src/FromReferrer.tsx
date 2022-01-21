/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Link } from 'react-router-dom';

export default function FromReferrer() {
  const contextUrl = document.referrer;

  if (contextUrl && contextUrl !== '' && new URL(contextUrl).pathname !== '/') {
    // Redirect to gitpod.io/#<contextUrl> to get the same experience as with direct call
    const url = new URL(window.location.toString());
    url.pathname = '/';
    url.hash = contextUrl;
    window.location.href = url.toString();
    return <div></div>;
  }

  return (
    <div className="app-container flex flex-col space-y-2">
      <div className="px-6 py-3 flex justify-between space-x-2 text-gray-400 h-96">
        <div className="flex flex-col items-center w-96 m-auto mt-40">
          <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Referrer Found</h3>
          <div className="text-center pb-6 text-gray-500">
            <p>
              It looks like you are trying to open a workspace, but the referrer URL is empty or has an incomplete path.
              This happens when the Git hoster or browser doesn't send the referrer header.
              <br /> Please prefix the repository URL with <pre>https://{window.location.host}/#</pre> in order to start
              a workspace.{' '}
              <a className="gp-link" href="https://www.gitpod.io/docs/getting-started/">
                Learn more
              </a>
            </p>
          </div>
          <span>
            <Link to="/">
              <button className="secondary">Go to Dashboard</button>
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
