import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

import TableOfContents from '@/components/TableOfContents';
import { createMarkdownComponents, extractHeadings } from '@/lib/markdown';

export default function DocsPage({ doc }) {
    const headings = extractHeadings(doc.content);

    return (
        <>
            <article className="prose">
                {!doc.hideHeader ? (
                    <>
                        <h1>{doc.title}</h1>
                        {doc.description ? <p className="description">{doc.description}</p> : null}
                    </>
                ) : null}
                
                <ReactMarkdown components={createMarkdownComponents()} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {doc.content}
                </ReactMarkdown>
            </article>

            <TableOfContents headings={headings} />
        </>
    );
}