/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import bitbucket from './images/bitbucket.svg';
import github from './images/github.svg';
import gitlab from './images/gitlab.svg';
import { gitpodHostUrl } from './service/service';

function iconForAuthProvider(type: string) {
  switch (type) {
    case 'GitHub':
      return <img className="fill-current dark:filter-invert w-5 h-5 ml-3 mr-3 my-auto" src={github} />;
    case 'GitLab':
      return <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={gitlab} />;
    case 'Bitbucket':
      return <img className="fill-current filter-grayscale w-5 h-5 ml-3 mr-3 my-auto" src={bitbucket} />;
    default:
      return <></>;
  }
}

function simplifyProviderName(host: string) {
  switch (host) {
    case 'github.com':
      return 'GitHub';
    case 'gitlab.com':
      return 'GitLab';
    case 'bitbucket.org':
      return 'Bitbucket';
    default:
      return host;
  }
}

interface OpenAuthorizeWindowParams {
  login?: boolean;
  host: string;
  scopes?: string[];
  overrideScopes?: boolean;
  overrideReturn?: string;
  onSuccess?: (payload?: string) => void;
  onError?: (error: string | { error: string; description?: string }) => void;
}

async function openAuthorizeWindow(params: OpenAuthorizeWindowParams) {
  const { login, host, scopes, overrideScopes, onSuccess, onError } = params;
  let search = 'message=success';
  const redirectURL = getSafeURLRedirect();
  if (redirectURL) {
    search = `${search}&returnTo=${encodeURIComponent(redirectURL)}`;
  }
  const returnTo = gitpodHostUrl.with({ pathname: 'complete-auth', search: search }).toString();
  const requestedScopes = scopes || [];
  const url = login
    ? gitpodHostUrl
        .withApi({
          pathname: '/login',
          search: `host=${host}&returnTo=${encodeURIComponent(returnTo)}`,
        })
        .toString()
    : gitpodHostUrl
        .withApi({
          pathname: '/authorize',
          search: `returnTo=${encodeURIComponent(returnTo)}&host=${host}${
            overrideScopes ? '&override=true' : ''
          }&scopes=${requestedScopes.join(',')}`,
        })
        .toString();

  const width = 800;
  const height = 800;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;

  // Optimistically assume that the new window was opened.
  window.open(
    url,
    'gitpod-auth-window',
    `width=${width},height=${height},top=${top},left=${left}status=yes,scrollbars=yes,resizable=yes`,
  );

  const eventListener = (event: MessageEvent) => {
    // todo: check event.origin

    const killAuthWindow = () => {
      window.removeEventListener('message', eventListener);

      if (event.source && 'close' in event.source && event.source.close) {
        console.log(`Received Auth Window Result. Closing Window.`);
        event.source.close();
      }
    };

    if (typeof event.data === 'string' && event.data.startsWith('success')) {
      killAuthWindow();
      onSuccess && onSuccess(event.data);
    }
    if (typeof event.data === 'string' && event.data.startsWith('error:')) {
      let error: string | { error: string; description?: string } = atob(event.data.substring('error:'.length));
      try {
        const payload = JSON.parse(error);
        if (typeof payload === 'object' && payload.error) {
          error = { ...payload };
        }
      } catch (error) {
        console.log(error);
      }

      killAuthWindow();
      onError && onError(error);
    }
  };
  window.addEventListener('message', eventListener);
}
const getSafeURLRedirect = (source?: string) => {
  const returnToURL: string | null = new URLSearchParams(source ? source : window.location.search).get('returnTo');
  if (returnToURL) {
    // Only allow oauth on the same host
    if (
      returnToURL
        .toLowerCase()
        .startsWith(`${window.location.protocol}//${window.location.host}/api/oauth/`.toLowerCase())
    ) {
      return returnToURL;
    }
  }
};

export { iconForAuthProvider, simplifyProviderName, openAuthorizeWindow, getSafeURLRedirect };
