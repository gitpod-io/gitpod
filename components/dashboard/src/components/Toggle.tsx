import { useState } from 'react';

function Toggle(props: { entries: { title: string, onActivate: ()=>void}[], active?: string }) {
    const [active, setActive] = useState(props.active || props.entries[0].title);
    return <div className="px-4 flex">
        {props.entries.map((e, i) => {
            let className = "mt-1 block w-20 text-sm border-2 border-gray-200 focus:outline-none";
            if (active === e.title) {
                className += " text-gray-600 bg-gray-200";
            } else {
                className += " text-gray-400";
            }
            if (i === 0) {
                className += " rounded-l-md";
            }
            if (i === props.entries.length - 1) {
                className += " border-l-0 rounded-r-md";
            }
            const onClick = () => {
                setActive(e.title);
                e.onActivate();
            }
            return <button key={e.title} className={className} onClick={onClick}>{e.title}</button>
        })}
        </div>;
}

export default Toggle;