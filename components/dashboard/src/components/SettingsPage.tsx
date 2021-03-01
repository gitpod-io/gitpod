import { SubMenuEntry } from './SubMenu';
import Header from './Header';
import { ThirdMenu, ThirdMenuEntry } from './ThirdMenu';

export interface Props {
    title: string;
    subtitle: string;
    tabs?: SubMenuEntry[];
    menuEntries: ThirdMenuEntry[];
    children: React.ReactNode;
}

export function SettingsPage(p: Props) {
    const tabs = p.tabs || [
        {
            title: 'Account',
            link: '/profile'
        },
        {
            title: 'Settings',
            link: '/env-vars'
        }
    ];
    return <div>
        <Header title={p.title} subtitle={p.subtitle} tabs={tabs}/>
        <div className='lg:px-28 px-10 flex pt-9'>
            <ThirdMenu entries={p.menuEntries} />
            <div className='ml-5 pl-12 w-full pt-1'>
                {p.children}
            </div>
        </div>
    </div>;
}