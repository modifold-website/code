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

**Last modified: October 10, 2025**

## Reporting Claims of Copyright Infringement

We take claims of copyright infringement seriously and respond to notices of alleged infringement that comply with applicable law, including the Online Copyright Infringement Liability Limitation Act of the Digital Millennium Copyright Act (17 U.S.C. § 512) ("DMCA"). If you believe any materials on Modifold (\`modifold.com\` or \`api.modifold.com\`; the "Service") infringe your copyright, you may request removal of those materials (or access to them) by submitting a written notification to our copyright agent at [support@modifold.com](mailto:support@modifold.com).

Your DMCA notice must include:
- Your physical or electronic signature.
- Identification of the copyrighted work you believe has been infringed, or a representative list if multiple works are involved.
- Identification of the infringing material in a precise manner to allow us to locate it.
- Contact information (name, postal address, telephone number, and email address).
- A statement that you have a good faith belief the use of the material is not authorized by the copyright owner, its agent, or the law.
- A statement that the information in the notice is accurate.
- A statement, under penalty of perjury, that you are authorized to act on behalf of the copyright owner.

If your DMCA notice does not comply with Section 512(c)(3) of the DMCA, it may not be effective.

**Warning**: Knowingly misrepresenting that material is infringing may result in liability for damages, including costs and attorneys’ fees, under Section 512(f) of the DMCA.

## Counter Notification Procedures

If you believe material you posted was removed or disabled by mistake or misidentification, you may file a counter notification by submitting a written notice to our copyright agent at [support@modifold.com](mailto:support@modifold.com). Your counter notice must include:
- Your physical or electronic signature.
- Identification of the material removed or disabled and its location before removal.
- Contact information (name, postal address, telephone number, and email address).
- A statement, under penalty of perjury, that you have a good faith belief the material was removed or disabled due to a mistake or misidentification.
- A statement that you consent to the jurisdiction of the Federal District Court for the judicial district where your address is located (or Delaware if you reside outside the United States) and that you accept service of process from the person who filed the original DMCA notice.

We may restore removed content if the original complainant does not file a court action against you within 10 business days of receiving your counter notice.

**Warning**: Knowingly misrepresenting that material was removed or disabled by mistake may result in liability for damages, including costs and attorneys’ fees, under Section 512(f) of the DMCA.

## Repeat Infringers

We may disable or terminate accounts of users who are repeat infringers, in accordance with our [Terms of Use](/legal/terms).

## Contact

For DMCA notices, counter notices, or questions about this policy, contact us at [support@modifold.com](mailto:support@modifold.com). See our [Privacy Policy](/legal/privacy) for details on how we handle your data.
`;

export default function CopyrightPolicy() {
    const pathname = usePathname();
    const isActive = (href) => pathname === href;

    return (
        <div className="layout">
            <div className="page-content settings-page">
                <div className="sidebar">
                    <div className="sidebar__main">
                        <Link href={`/legal/terms`} className={`sidebar-item ${isActive(`/legal/terms`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42"></path><path d="M12 5.36 8.87 8.5a2.13 2.13 0 0 0 0 3h0a2.13 2.13 0 0 0 3 0l2.26-2.21a3 3 0 0 1 4.22 0l2.4 2.4M18 15l-2-2M15 18l-2-2"></path></svg>

                            Terms of Use
                        </Link>

                        <Link href={`/legal/rules`} className={`sidebar-item ${isActive(`/legal/rules`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m3 6 3 1m0 0-3 9a5 5 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>

                            Content Rules
                        </Link>

                        <Link href={`/legal/privacy`} className={`sidebar-item ${isActive(`/legal/privacy`) ? "sidebar-item--active" : ""}`} data-ripple>
                            <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>

                            Privacy Policy
                        </Link>

                        <Link href={`/legal/copyright`} className={`sidebar-item ${isActive(`/legal/copyright`) ? "sidebar-item--active" : ""}`} data-ripple>
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