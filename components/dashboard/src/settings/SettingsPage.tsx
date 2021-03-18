import { Link } from "react-router-dom";
import Header from '../components/Header';
import settingsMenu from "./settings-menu";

export interface Props {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

export function SettingsPage(p: Props) {
    return <div>
        <Header title={p.title} subtitle={p.subtitle}/>
        <div className='lg:px-28 px-10 flex pt-9'>
            <div>
                <ul className="flex flex-col text-sm text-gray-500 pt-4 lg:pt-0 w-48 space-y-2">
                    {settingsMenu.map(e => {
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
            </div>
            <div className='ml-32 w-full pt-1'>
                {p.children}
            </div>
        </div>
    </div>;
}