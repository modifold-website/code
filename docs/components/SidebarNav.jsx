"use client";

import Link from 'next/link';
import { BookOpen, ChevronDown, Box, Star, Tags, Users } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

function prettyLabel(segment) {
    if(segment === 'api') {
        return 'Modifold API';
    }

	if(segment === 'api-v2') {
		return 'API v2';
	}

    if(segment === 'projects') {
        return 'projects';
    }

    if(segment === 'users') {
        return 'users';
    }

    if(segment === 'tags') {
        return 'tags';
    }

    if(segment === 'contributing') {
        return 'Contributing';
    }

    if(segment === 'guide') {
        return 'Guides';
    }

    return segment.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

const segmentIcons = {
    projects: Box,
    tags: Tags,
    users: Users,
};

function getNodeIcon(node) {
    return segmentIcons[node.segment] || BookOpen;
}

function buildTree(docs) {
    const root = [];

    for(const doc of docs) {
        if(doc.slug.length === 0) {
            continue;
        }

        let level = root;
        let pathParts = [];

        for(let i = 0; i < doc.slug.length; i++) {
            const segment = doc.slug[i];
            pathParts = [...pathParts, segment];
            const key = pathParts.join('/');
            const href = `/${key}`;
            const isLeaf = i === doc.slug.length - 1;

            let node = level.find((item) => item.key === key);
            if(!node) {
                node = {
                    key,
                    segment,
                    label: isLeaf ? doc.title : prettyLabel(segment),
                    href,
                    children: [],
                    isLeaf,
                    order: doc.order,
                };
                level.push(node);
            }

            if(isLeaf) {
                node.label = doc.title;
                node.isLeaf = true;
                node.order = doc.order;
            }

            node.order = Math.min(node.order, doc.order);
            level = node.children;
        }
    }

    sortTree(root);
    return root;
}

function sortTree(nodes) {
    nodes.sort((a, b) => {
        const orderA = Number.isFinite(a.order) ? a.order : Number.POSITIVE_INFINITY;
        const orderB = Number.isFinite(b.order) ? b.order : Number.POSITIVE_INFINITY;

        return orderA - orderB || a.label.localeCompare(b.label);
    });
    nodes.forEach((node) => sortTree(node.children));
}

function collectAncestors(pathname) {
    const clean = pathname.replace(/^\//, '');
    if(!clean) {
        return [];
    }

    const segments = clean.split('/');
    const keys = [];
    for(let i = 0; i < segments.length - 1; i++) {
        keys.push(segments.slice(0, i + 1).join('/'));
    }

    return keys;
}

function TreeNode({ node, pathname, openKeys, onToggle, depth, siblingKeys, parentKey }) {
    const isActive = pathname === node.href;
    const hasChildren = node.children.length > 0;
    const isOpen = openKeys.has(node.key);
    const Icon = getNodeIcon(node);

    if(!hasChildren) {
        return (
            <li>
                <Link href={node.href} className={isActive ? 'is-active' : ''} title={node.label}>
                    <Icon className="sidebar-link-icon" size={20} />
                    
                    <span className="sidebar-label">{node.label}</span>
                </Link>
            </li>
        );
    }

    return (
        <li>
            <button className={`sidebar-toggle ${isOpen ? 'is-open' : ''}`} onClick={() => onToggle(node.key, parentKey, siblingKeys)} type="button" title={node.label}>
                <span className="sidebar-toggle-main">
                    <Icon className="sidebar-link-icon" size={20} />
                    
                    <span className="sidebar-label">{node.label}</span>
                </span>

                <ChevronDown className="sidebar-chevron" size={18} />
            </button>

            {isOpen ? (
                <ul className={`sidebar-tree depth-${depth + 1}`}>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.key}
                            node={child}
                            pathname={pathname}
                            openKeys={openKeys}
                            onToggle={onToggle}
                            depth={depth + 1}
                            siblingKeys={node.children.map((item) => item.key)}
                            parentKey={node.key}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

export default function SidebarNav({ docs, defaultOpenKeys = [] }) {
    const pathname = usePathname();
    const tree = useMemo(() => buildTree(docs), [docs]);
    const [openKeys, setOpenKeys] = useState(() => new Set([...defaultOpenKeys, ...collectAncestors(pathname)]));

    useEffect(() => {
        const auto = collectAncestors(pathname);
        setOpenKeys((prev) => new Set([...defaultOpenKeys, ...prev, ...auto]));
    }, [pathname, defaultOpenKeys]);

    function toggle(key, _parentKey, siblingKeys) {
        setOpenKeys((prev) => {
            const next = new Set(prev);
            const isOpen = next.has(key);

            if(isOpen) {
                for(const value of [...next]) {
                    if(value === key || value.startsWith(`${key}/`)) {
                        next.delete(value);
                    }
                }

                return next;
            }

            for(const sibling of siblingKeys) {
                if(sibling === key) {
                    continue;
                }

                for(const value of [...next]) {
                    if(value === sibling || value.startsWith(`${sibling}/`)) {
                        next.delete(value);
                    }
                }
            }

            next.add(key);
            return next;
        });
    }

    const homeActive = pathname === '/';

    return (
        <nav>
            <p className="section-title">Navigation</p>
            <ul className="sidebar-tree depth-0">
                <li>
                    <Link href="/" className={homeActive ? 'is-active' : ''}>
                        <Star className={homeActive ? 'sidebar-link-icon is-active-icon' : 'sidebar-link-icon'} size={20} />
                        
                        <span className="sidebar-label">Home</span>
                    </Link>
                </li>

                {tree.map((node) => (
                    <TreeNode
                        key={node.key}
                        node={node}
                        pathname={pathname}
                        openKeys={openKeys}
                        onToggle={toggle}
                        depth={0}
                        siblingKeys={tree.map((item) => item.key)}
                        parentKey=""
                    />
                ))}
            </ul>

            <p className="sidebar-footer">
                <span style={{ fontWeight: 400 }}>Powered by <a style={{ marginTop: 0, color: '#067aff', fontWeight: 500 }} href="https://modifold.com" target="_blank" rel="noreferrer">Modifold</a></span>
                
                <a href="https://github.com/modifold-website/code/tree/main/docs" target="_blank" rel="noreferrer">
                    Open-source on GitHub
                </a>
            </p>
        </nav>
    );
}