/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

function Arrow(props: { up: boolean }) {
  return (
    <span
      className="mx-2 border-gray-400 dark:border-gray-600 group-hover:border-gray-600 dark:group-hover:border-gray-400"
      style={{
        marginTop: 2,
        marginBottom: 2,
        padding: 3,
        borderWidth: '0 2px 2px 0',
        display: 'inline-block',
        transform: `rotate(${props.up ? '-135deg' : '45deg'})`,
      }}
    ></span>
  );
}

export default Arrow;
