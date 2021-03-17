# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.

components:
  proxy:
    loadBalancerIP: ${loadBalancerIP}

branding:
  homepage: ${hostname}
  redirectUrlIfNotAuthenticated: /workspaces/
  redirectUrlAfterLogout: ${hostname}
