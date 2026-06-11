import { notFound } from 'next/navigation';

import DocsPage from '@/components/DocsPage';
import { getAllDocs, getDocBySlug } from '@/lib/docs';

export function generateStaticParams() {
    return getAllDocs().filter((doc) => doc.slug.length > 0).map((doc) => ({ slug: doc.slug }));
}

export default async function DocPageRoute({ params }) {
    const { slug } = await params;
    const doc = getDocBySlug(slug);

    if(!doc) {
        notFound();
    }

    return <DocsPage doc={doc} />;
}