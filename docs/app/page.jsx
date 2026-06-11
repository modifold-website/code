import { notFound } from 'next/navigation';

import DocsPage from '@/components/DocsPage';
import { getDocBySlug } from '@/lib/docs';

export default function HomePage() {
    const doc = getDocBySlug([]);
    if(!doc) {
        notFound();
    }

    return <DocsPage doc={doc} />;
}