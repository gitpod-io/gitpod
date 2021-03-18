import { useState } from 'react';

export interface ContextMenuProps {
    children: React.ReactChild[] | React.ReactChild;
    menuEntries: ContextMenuEntry[];
    width?: string;
}

export interface ContextMenuEntry {
    title: string;
    active?: boolean;
    /**
     * whether a separator line should be rendered below this item
     */
    separator?: boolean;
    customFontStyle?: string;
    onClick?: ()=>void;
    href?: string;
}

function ContextMenu(props: ContextMenuProps) {
    const [expanded, setExpanded] = useState(false);
    const toggleExpanded = () => {
        setExpanded(!expanded);
    }

    if (expanded) {
        // HACK! I want to skip the bubbling phase of the current click
        setTimeout(() => {
            window.addEventListener('click', () => setExpanded(false), { once: true });
        }, 0);
    }
  
    const enhancedEntries = props.menuEntries.map(e => {
        return {
            ... e,
            onClick: () => {
                e.onClick && e.onClick();
                toggleExpanded();
            }
        }
    })
    const font = "text-gray-400 hover:text-gray-800"
    return (
        <div className="relative cursor-pointer">
            <div onClick={(e) => {
                toggleExpanded();
                e.preventDefault();
            }}>
                {props.children}
            </div>
            {expanded?
                <div className={`z-50 ${props.width || 'w-40'} bg-white absolute py-2 right-0 flex flex-col border border-gray-200 rounded-lg space-y-2`}>
                    {enhancedEntries.map(e => {
                        const entry = <div key={e.title} className={`px-4 flex py-2 text-gray-600 hover:bg-gray-200 text-sm leading-1 ${e.customFontStyle || font} ${e.separator? ' border-b border-gray-200':''}`} >
                            <div>{e.title}</div><div className="flex-1"></div>{e.active ? <div className="pl-1 font-semibold">&#x2713;</div>: null}
                        </div>
                        return <a href={e.href} onClick={e.onClick}>
                            {entry}
                        </a>
                    })}
                </div>
            :
                null
            }
        </div>
    );
}

export default ContextMenu;