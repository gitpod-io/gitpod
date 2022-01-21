/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

module.exports = {
  root: true,
  extends: ['react-app', 'plugin:prettier/recommended'],
  rules: {
    'import/no-anonymous-default-export': 'off',
  },
};
