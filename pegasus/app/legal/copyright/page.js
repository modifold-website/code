"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePathname } from "next/navigation";
import Link from "next/link";

const getSafeMarkdownHref = (href) => {
    if(typeof href !== "string") {
        return null;
    }

    if(href.startsWith("/") || href.startsWith("#")) {
        return href;
    }

    try {
        const parsed = new URL(href);
        if(!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
};

const copyrightPolicy = `
# Copyright Policy

**Last modified: October 17, 2026**

Modifold is operated by **Modifold LLC** (ООО «Modifold»), located in the **Republic of Belarus**. In this Copyright Policy, "we", "us", and "our" refer to Modifold LLC.

## Reporting Claims of Copyright Infringement

We take claims of copyright infringement seriously and review them in accordance with applicable law. If you believe materials on Modifold (\`modifold.com\` or \`api.modifold.com\`; the "Service") infringe your copyright, send a complaint to [support@modifold.com](mailto:support@modifold.com).

Please include:
- Your name and contact email address.
- The name of the copyright owner and, if you represent them, information confirming your authority to act on their behalf.
- Identification of the copyrighted work, with links or other supporting evidence where available.
- Direct links to the project, version, file, or other material you are reporting.
- An explanation of the alleged infringement, including relevant ownership or licensing information.
- Confirmation that the information you provide is accurate to the best of your knowledge and that you are submitting the complaint in good faith.

We may request additional information needed to assess a complaint. Please do not send unrelated personal data or identity documents unless we specifically request them for a lawful purpose.

## Review and Action

We review the information provided and may contact the uploader for an explanation or evidence of permission. We may temporarily restrict access to the reported material while reviewing a complaint and may remove it if we determine that it violates applicable law or our policies.

We handle personal information in accordance with our [Privacy Policy](/legal/privacy) and limit any sharing during a review to what is necessary and lawful.

## Appealing a Removal

If you believe your material was removed or restricted by mistake, contact [support@modifold.com](mailto:support@modifold.com). Include the material's link or former location, the reason you disagree with the decision, and any relevant license, permission, or other supporting evidence.

We review appeals and may request clarification from either party. Restoration depends on the information available, applicable law, and any binding legal requirements; submitting an appeal does not automatically restore the material. Any legally required procedures or deadlines continue to apply.

Complaints and appeals must be truthful. Please do not use this process to submit knowingly false or abusive claims.

## Repeat Infringers

We may disable or terminate accounts of users who are repeat infringers, in accordance with our [Terms of Use](/legal/terms).

## Contact

For copyright complaints, appeals, or questions about this policy, contact us at [support@modifold.com](mailto:support@modifold.com). Requests from public authorities should also be directed to this address and are handled as described in our [Terms of Use](/legal/terms) and [Privacy Policy](/legal/privacy).
`;

export default function CopyrightPolicy() {
    const pathname = usePathname();
    const isActive = (href) => pathname === href;

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <div className="sidebar">
                    <div className="sidebar__main">
                        <Link prefetch={false} href={`/legal/terms`} className={`sidebar-item ${isActive(`/legal/terms`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42"></path><path d="M12 5.36 8.87 8.5a2.13 2.13 0 0 0 0 3h0a2.13 2.13 0 0 0 3 0l2.26-2.21a3 3 0 0 1 4.22 0l2.4 2.4M18 15l-2-2M15 18l-2-2"></path></svg>

                            Terms of Use
                        </Link>

                        <Link prefetch={false} href={`/legal/rules`} className={`sidebar-item ${isActive(`/legal/rules`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m3 6 3 1m0 0-3 9a5 5 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>

                            Content Rules
                        </Link>

                        <Link prefetch={false} href={`/legal/privacy`} className={`sidebar-item ${isActive(`/legal/privacy`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>

                            Privacy Policy
                        </Link>

                        <Link prefetch={false} href={`/legal/copyright`} className={`sidebar-item ${isActive(`/legal/copyright`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M15 9.354a4 4 0 1 0 0 5.292"></path></svg>

                            Copyright Policy
                        </Link>
                    </div>
                </div>

                <div className="content content--padding markdown-body">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            a: ({ href, children }) => {
                                const safeHref = getSafeMarkdownHref(href);
                                if(!safeHref) {
                                    return <>{children}</>;
                                }

                                const isExternal = /^https?:\/\//i.test(safeHref);
                                return (
                                    <a href={safeHref} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>
                                        {children}
                                    </a>
                                );
                            },
                        }}
                    >
                        {copyrightPolicy}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}