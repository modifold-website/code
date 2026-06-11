import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';

export default function NotFound() {
    return (
        <section className="not-found-page" aria-labelledby="not-found-title">            
            <h1 id="not-found-title">Page not found</h1>
            
            <p>
                This page is not in the docs, or the link has moved. Head back home or jump into
                the API reference.
            </p>

            <div className="not-found-actions">
                <Link href="/" className="not-found-action not-found-action-primary">
                    <ArrowLeft size={16} />

                    Home
                </Link>
            </div>
        </section>
    );
}