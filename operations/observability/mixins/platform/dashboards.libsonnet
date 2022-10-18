/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the MIT License. See License.MIT.txt in the project root for license information.
 */

{
  grafanaDashboards+:: {
    // Import raw json files here.
    // Example:
    // 'my-new-dashboard.json': (import 'dashboards/components/new-component.json'),
    'gitpod-preview-envs-overview.json': (import 'dashboards/preview-environments/overview.json'),
  },
}
