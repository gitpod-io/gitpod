import { useContext } from "react";
import { Link } from "react-router-dom";
import { ServiceContext } from "../service/service";

interface Entry {
    title: string, link: string
}

function Menu(props: { left: Entry[], right: Entry[] }) {
    const ctx = useContext(ServiceContext);
    return (
        <header className="lg:px-28 px-10 bg-white flex flex-wrap items-center py-4">
            <style dangerouslySetInnerHTML={{
                __html: `
                #menu-toggle:checked+#menu {
                    display: block;
                }
                `}} />
            <div className="flex justify-between items-center pr-3">
                <Link to="/">
                    <img src="/gitpod.svg" className="h-6" />
                </Link>
            </div>
            <div className="lg:hidden flex-grow" />
            <label htmlFor="menu-toggle" className="pointer-cursor lg:hidden block">
                <svg className="fill-current text-gray-700"
                    xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
                    <title>menu</title>
                    <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"></path>
                </svg>
            </label>
            <input className="hidden" type="checkbox" id="menu-toggle" />
            <div className="hidden lg:flex lg:flex-1 lg:items-center lg:w-auto w-full" id="menu">
                <nav className="lg:flex-1">
                    <ul className="lg:flex lg:flex-1 items-center justify-between text-base text-gray-700 space-x-2">
                        {props.left.map(e => {
                            let classes = "flex block text-sm font-medium lg:px-3 px-0 py-2 rounded-md";
                            if (window.location.pathname.toLowerCase() === e.link.toLowerCase()) {
                                classes += " bg-gray-200";
                            } else {
                                classes += " text-gray-500 hover:bg-gray-300 ";
                            }
                            return <li key={e.title}>
                                <Link className={classes} to={e.link}>
                                    <div>{e.title}</div>
                                </Link>
                            </li>;
                        })}
                        <li className="flex-1"></li>
                        {props.right.map(e => {
                            let classes = "flex block text-sm font-medium lg:px-3 px-0 py-2 rounded-md";
                            if (window.location.pathname.toLowerCase() === e.link.toLowerCase()) {
                                classes += " bg-gray-200";
                            } else {
                                classes += " text-gray-500 hover:bg-gray-300 ";
                            }
                            return <li key={e.title}>
                                <Link className={classes} to={e.link}>
                                    <div>{e.title}</div>
                                </Link>
                            </li>;
                        }
                        )}
                    </ul>
                </nav>
                <Link className="lg:ml-4 flex items-center justify-start lg:mb-0 mb-4 pointer-cursor m-l-auto rounded-full border-2 hover:border-gray-400 p-0.5" to="/profile">
                    <img className="rounded-full w-6 h-6"
                        src={ctx.getUser().avatarUrl} alt={ctx.getUser().name} />
                </Link>
            </div>
        </header>
    );
}

export default Menu;