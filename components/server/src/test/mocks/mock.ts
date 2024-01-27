/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export interface Mock<T extends Object> {
    override(override: Partial<T>): void;
}

export function createMock<T extends Object>(target?: T): T & Mock<T> {
    const overriddenMethods: Map<string, any> = new Map();

    function override<T>(override: Partial<T>): void {
        for (const [key, value] of Object.entries(override)) {
            overriddenMethods.set(key, value);
        }
    }

    return new Proxy(target || {}, {
        get: (target, prop) => {
            const name = String(prop);
            if (name === "override") {
                return override;
            }
            const fun = overriddenMethods.get(name);
            if (fun) {
                return fun;
            }
            return (target as any)[name];
        },
    }) as unknown as T & Mock<T>;
}
