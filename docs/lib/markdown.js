import CodeBlock from '@/components/CodeBlock';
import EndpointHeading from '@/components/EndpointHeading';

function flattenText(node) {
    if(typeof node === 'string') {
        return node;
    }

    if(!node || !node.props) {
        return '';
    }

    const children = node.props.children;
    if(Array.isArray(children)) {
        return children.map(flattenText).join('');
    }

    return flattenText(children);
}

export function slugify(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function createHeadingIdFactory() {
    const seen = new Map();

    return (text) => {
        const baseId = slugify(text) || 'section';
        const count = seen.get(baseId) || 0;
        seen.set(baseId, count + 1);

        return count === 0 ? baseId : `${baseId}-${count + 1}`;
    };
}

function parseEndpointHeading(text) {
    const match = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(.+)$/i.exec(text);

    if(!match) {
        return null;
    }

    return {
        method: match[1].toUpperCase(),
        path: match[2],
    };
}

function getStatusClass(status) {
    if(/^2\d\d$/.test(status)) {
        return 'status-success';
    }

    if(/^3\d\d$/.test(status)) {
        return 'status-info';
    }

    if(/^4\d\d$/.test(status)) {
        return 'status-warning';
    }

    if(/^5\d\d$/.test(status)) {
        return 'status-danger';
    }

    return null;
}

function renderApiTableValue(children) {
    const text = flattenText({ props: { children } }).trim();
    const statusClass = getStatusClass(text);
    const typeValues = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object', 'file', '$ref', '`$ref`']);
    const isSchemaType = typeValues.has(text.toLowerCase()) || /^array<.+>$/i.test(text) || /^[a-z]+ \([^)]+\)$/i.test(text);

    if(statusClass) {
        return <span className={`api-badge status-badge ${statusClass}`}>{text}</span>;
    }

    if(text === 'yes' || text === 'no') {
        return <span className={`api-badge required-badge required-${text}`}>{text}</span>;
    }

    if(isSchemaType) {
        return <span className="api-badge type-badge">{text}</span>;
    }

    return children;
}

export function extractHeadings(markdown) {
    const getHeadingId = createHeadingIdFactory();

    return markdown.split('\n').filter((line) => line.startsWith('## ') || line.startsWith('### ')).map((line) => {
        const depth = line.startsWith('### ') ? 3 : 2;
        const text = line.replace(/^###?\s+/, '').trim();
        return {
            depth,
            text,
            id: getHeadingId(text),
        };
    });
}

export function createMarkdownComponents() {
    const getHeadingId = createHeadingIdFactory();

    return {
        h2({ children }) {
            const text = flattenText({ props: { children } });
            const id = getHeadingId(text);
            const endpoint = parseEndpointHeading(text);

            if(endpoint) {
                return <EndpointHeading id={id} method={endpoint.method} path={endpoint.path} />;
            }

            return <h2 id={id}>{children}</h2>;
        },
        h3({ children }) {
            const text = flattenText({ props: { children } });
            const id = getHeadingId(text);
            return <h3 id={id}>{children}</h3>;
        },
        a({ href, children, ...props }) {
            const isExternal = /^https?:\/\//i.test(href || '');

            return (
                <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined} {...props}>
                    {children}
                </a>
            );
        },
        table({ children }) {
            return (
                <div className="table-scroll">
                    <table>{children}</table>
                </div>
            );
        },
        td({ children }) {
            return <td>{renderApiTableValue(children)}</td>;
        },
        code({ node: _node, className, children, ...props }) {
            const match = /language-([a-z0-9_+-]+)/i.exec(className || '');
            const language = match ? match[1] : 'text';
            const code = String(children || '');
            const isBlock = Boolean(match) || code.includes('\n');

            if(!isBlock) {
                return (
                    <code className={className} {...props}>
                        {children}
                    </code>
                );
            }

            return <CodeBlock code={code} language={language} />;
        },
    };
}