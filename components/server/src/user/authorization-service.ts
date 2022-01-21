/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';

import { Permission, RoleOrPermission, RoleName, PermissionName, Role } from '@gitpod/gitpod-protocol/lib/permission';
import { User } from '@gitpod/gitpod-protocol';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

export const AuthorizationService = Symbol('AuthorizationService');
export interface AuthorizationService {
  hasPermission(user: User, permission: PermissionName): boolean;
}

@injectable()
export class AuthorizationServiceImpl implements AuthorizationService {
  public hasPermission(user: User, permission: PermissionName): boolean {
    const rop: RoleOrPermission[] = user.rolesOrPermissions || [];
    try {
      const permissions = this.calculatePermissions(rop);
      return permissions.includes(permission);
    } catch (err) {
      log.error({ userId: user.id }, 'Invalid role or permission', { rolesOrPermissions: rop });
      return false;
    }
  }

  protected calculatePermissions = (rolesOrPermissions: RoleOrPermission[]): PermissionName[] => {
    const permissions: PermissionName[] = [];
    for (const rop of rolesOrPermissions) {
      if (Permission.is(rop)) {
        permissions.push(rop as PermissionName);
      } else if (RoleName.is(rop)) {
        Role.getByName(rop).permissions.forEach((p) => permissions.push(p));
      }
    }

    const result: PermissionName[] = [];
    new Set(permissions).forEach((e) => result.push(e));
    return result;
  };
}
