import { Link } from "react-router-dom";

export interface SubMenuEntry {
    title: string
    link: string
}

export function SubMenu(props: { entries: SubMenuEntry[] }) {
    return <div>
        <ul className="flex flex-col text-sm text-gray-500 pt-4 lg:pt-0 w-48 space-y-2">
            {props.entries.map(e => {
                let classes = "flex block py-2 font-sm px-4 rounded-md";
                if (e.link.toLowerCase() === window.location.pathname) {
                    classes += " bg-gray-800 text-gray-50";
                } else {
                    classes += " hover:bg-gray-100";
                }
                return <Link to={e.link} key={e.title}>
                    <li className={classes}>
                        {e.title}
                    </li>
                </Link>;
            })}
        </ul>
    </div>;
}