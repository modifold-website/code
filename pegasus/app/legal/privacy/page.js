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

const privacyPolicy = `
# Privacy Policy

**Last modified: February 26, 2026**

## 1. Overview

Modifold ("Modifold", "we", "us", "our") is a platform for discovering, publishing, and managing gaming-related content.

This Privacy Policy explains what information we collect, how we use it, when we share it, and what rights you may have.

This Policy applies to:
- modifold.com
- api.modifold.com
- related services, pages, and features operated by Modifold (collectively, the "Service")

It does not apply to third-party websites or services that may be linked from Modifold.

## 2. Compliance and Jurisdiction Context (Including Belarus)

Modifold serves users internationally. Our owner and part of our team are located in the **Republic of Belarus**, and Belarus is an important jurisdiction for our operations.

We aim to process personal data in accordance with applicable law, which may include:
- laws of the Republic of Belarus;
- the EU General Data Protection Regulation (GDPR), where applicable;
- the California Consumer Privacy Act (CCPA/CPRA), where applicable; and
- other applicable privacy and data protection laws.

For data processed through the Service, Modifold generally acts as the **data controller** (or equivalent concept under applicable law).

## 3. Information We Collect

### 3.1 Account Information

When you create or maintain an account, we may collect:
- email address;
- username and display name;
- profile image (optional);
- profile description and social links (optional);
- account preferences (such as language or theme settings).

### 3.2 Project and Version Data

When you create or manage projects/versions, we may process:
- project metadata (title, description, tags, links, categories);
- version metadata (version number, changelog, release channel, supported game versions/loaders);
- uploaded files and related metadata (filename, size, type, hashes where applicable);
- moderation-related notes or status data.

### 3.3 Collaboration and Permissions Data

If you use project collaboration features, we may process:
- project membership records;
- roles and permission assignments;
- invitation records (sender, recipient, status, timestamps);
- project-management activity logs (such as version uploads/edits/deletes, member changes, and settings changes).

We use this data to provide role-based collaboration, improve security, and investigate abuse or unauthorized actions.

### 3.4 Usage, View, and Download Data

When you use the Service (including viewing project pages or downloading files), we may collect:
- IP address;
- user/account identifier (if logged in);
- project or file identifiers;
- approximate location data derived from IP (such as country);
- device, browser, and request metadata (for example user agent, headers, timestamps, referrer when available).

### 3.5 Analytics Data (Consent-Based Where Required)

When required by law, we collect analytics data only after your consent. This may include data processed through tools such as **Google Analytics** and **Yandex Metrika**, for example:
- pages visited and session duration;
- interactions and click events;
- browser/device information;
- approximate geolocation;
- pseudonymous identifiers.

### 3.6 Cookies and Similar Technologies

We use cookies and similar technologies for:
- authentication and session management;
- storing preferences (such as language/theme);
- security and abuse prevention;
- analytics (where permitted and/or consented to).

You can manage cookie preferences through browser settings and, where available, our cookie consent tools.

## 4. How We Use Information

We use personal data to:
- provide and operate the Service;
- authenticate users and secure accounts;
- host, process, and deliver user content and project files;
- enable project collaboration features and permission-based actions;
- provide support and respond to requests;
- improve performance, reliability, and user experience;
- measure usage and analytics (subject to consent where required);
- detect, prevent, and investigate abuse, fraud, or security incidents;
- comply with legal obligations and enforce our terms/policies.

## 5. Legal Bases for Processing (Where Applicable)

Depending on your location and applicable law, we may process personal data based on one or more of the following legal bases:
- **Contract**: to provide the Service you request (for example account, uploads, project management);
- **Legitimate interests**: to secure, maintain, and improve the Service, prevent abuse, and operate collaboration features;
- **Consent**: for analytics cookies/tools or other optional processing where consent is required;
- **Legal obligation**: to comply with applicable law, legal process, or regulatory requests.

## 6. How We Share Information

We do **not sell** personal data.

We may share information:
- with service providers that help us operate the Service (for example infrastructure, analytics providers, security tools), subject to appropriate obligations;
- when required by law, court order, or legal process;
- to protect the rights, safety, and security of Modifold, users, or others;
- in connection with a merger, acquisition, financing, or asset transfer (subject to applicable confidentiality and notice obligations).

Where analytics providers are used, related sharing may depend on your consent where required by law.

## 7. Data Retention

We retain information for as long as reasonably necessary for the purposes described in this Policy, including to provide the Service, comply with legal obligations, resolve disputes, and enforce our policies.

Examples (which may change over time):
- account data: while your account remains active, plus a reasonable period for legal/security purposes;
- project/version metadata and files: while published or retained by the project owner, plus backup/operational retention periods;
- logs (including security/audit logs): retained for operational, abuse-prevention, and compliance needs, then deleted or anonymized where appropriate;
- analytics data: retained according to provider settings and your consent choices where applicable.

## 8. International Data Transfers

Because Modifold serves users internationally, your information may be processed in countries other than your own.

Where required by law, we take reasonable steps to implement appropriate safeguards for cross-border transfers.

## 9. Security

We use reasonable technical and organizational measures to protect personal data, including measures for transport security, access control, and abuse prevention.

However, no method of storage or transmission is completely secure, and we cannot guarantee absolute security.

## 10. Your Rights and Choices

Depending on applicable law, you may have rights such as:
- access to your personal data;
- correction of inaccurate data;
- deletion of personal data;
- restriction of processing;
- objection to certain processing;
- data portability;
- withdrawal of consent (for consent-based processing);
- complaint to a supervisory authority.

To exercise rights or ask privacy questions, contact us at [support@modifold.com](mailto:support@modifold.com).

We may need to verify your identity before fulfilling certain requests.

## 11. Children's Privacy

The Service is not intended for children under **13**, and we do not knowingly collect personal data from children under 13.

If you believe a child under 13 has provided personal data to us, contact us at [support@modifold.com](mailto:support@modifold.com), and we will review and take appropriate action.

## 12. Changes to This Policy

We may update this Privacy Policy from time to time.

When we do, we will update the "Last modified" date above and may provide additional notice for material changes when practical.

## 13. Contact Us

For privacy requests or questions, contact: [support@modifold.com](mailto:support@modifold.com)

If you believe your data is being processed unlawfully, you may also contact a competent data protection authority, including a relevant authority in the Republic of Belarus or in your jurisdiction, where applicable.
`;

export default function PrivacyPolicy() {
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
                        {privacyPolicy}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}