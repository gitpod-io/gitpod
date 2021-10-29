/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License-MIT.txt in the project root for license information.
 */

{
  _config+:: {
    // Make it possible to generate dashboards compatible with multicluster installations
    showMultiCluster: true,
    clusterLabel: 'cluster',

    gitpodURL: 'https://gitpod.io',

    dashboardNamePrefix: 'Gitpod / ',
    dashboardTags: ['gitpod-mixin'],
  },
}
