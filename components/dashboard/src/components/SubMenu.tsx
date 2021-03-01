import { Link } from "react-router-dom";

export interface SubMenuEntry {
    title: string
    link: string
    hover?: string
}

export function SubMenu(props: { menuEntries: SubMenuEntry[] }) {
    return <div>
        <ul className="lg:flex lg:flex-1 items-center lg:space-x-8 text-base text-gray-700 pt-4 lg:pt-0">
            {props.menuEntries.map(e => {
                let classes = "flex block pb-4 border-b-4 border-transparent font-medium";
                if (window.location.pathname.startsWith(e.link)) {
                    classes += " border-gray-700";
                } else {
                    classes += " text-gray-500 hover:border-gray-400 ";
                }
                return <Link to={e.link}>
                    <li className={classes}>
                        {e.title}
                    </li>
                </Link>;
            })}
        </ul>
    </div>;
}