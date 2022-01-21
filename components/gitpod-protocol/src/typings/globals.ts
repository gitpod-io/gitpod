/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

interface Window {
  gitpod: {
    service: import('../gitpod-service').GitpodService;
    ideService?: import('../ide-frontend-service').IDEFrontendService;
  };
}
