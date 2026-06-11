import { cookies } from 'next/headers';
import Link from 'next/link';

import RouteTransitionManager from '@/utils/RouteTransitionManager';
import SearchBox from '@/components/SearchBox';
import ThemeSelect from '@/components/ThemeSelect';
import SidebarNav from '@/components/SidebarNav';
import { getAllDocs } from '@/lib/docs';
import './globals.css';

export const metadata = {
    title: 'Modifold Documentation',
    description: 'Developer documentation for Modifold!',
};

export default async function RootLayout({ children }) {
    const allDocs = getAllDocs();
    const docs = allDocs.filter((doc) => doc.slug.length > 0);
    const searchItems = allDocs.map((doc) => ({
        href: doc.slug.length ? `/${doc.slug.join('/')}` : '/',
        title: doc.title,
        description: doc.description || '',
        searchText: doc.content.replace(/```[\s\S]*?```/g, ' ').replace(/[#*_`|>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 6000),
    })).sort((a, b) => a.href.localeCompare(b.href));
    const cookieStore = await cookies();
    const themeCookie = cookieStore.get('theme-preference')?.value;
    const initialTheme = themeCookie === 'light' || themeCookie === 'dark' ? themeCookie : 'dark';
    const bodyThemeClass = `theme-${initialTheme}`;

    return (
        <html lang="en">
            <body className={bodyThemeClass}>
                <RouteTransitionManager />

                <header className="topbar">
                    <Link href="/" className="brand-logo-link" aria-label="Modifold docs home">
                        <img src="/assets/light-logo.svg" alt="Modifold docs" className="brand-logo brand-logo-light" />
                        <img src="/assets/dark-logo.svg" alt="Modifold docs" className="brand-logo brand-logo-dark" />
                    </Link>

                    <SearchBox items={searchItems} />

                    <ThemeSelect initialTheme={initialTheme} />
                </header>

                <div className="shell">
                    <aside className="sidebar">
                        <SidebarNav docs={docs} defaultOpenKeys={['api']} />
                    </aside>

                    <main className="content content-transition-frame">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    );
}