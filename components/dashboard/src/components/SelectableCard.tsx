/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export interface SelectableCardProps {
  title: string;
  selected: boolean;
  className?: string;
  onClick: () => void;
  children?: React.ReactNode;
}

function SelectableCard(props: SelectableCardProps) {
  return (
    <div
      className={`rounded-xl px-3 py-3 flex flex-col cursor-pointer group border-2 transition ease-in-out ${
        props.selected
          ? 'border-green-500'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400'
      } ${props.className || ''}`}
      onClick={props.onClick}
    >
      <div className="flex items-center">
        <p
          className={`w-full pl-1 text-base font-semibold truncate ${
            props.selected ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'
          }`}
          title={props.title}
        >
          {props.title}
        </p>
        <input
          className={'text-green-500 ' + (props.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
          type="radio"
          checked={props.selected}
        />
      </div>
      {props.children}
    </div>
  );
}

export default SelectableCard;
