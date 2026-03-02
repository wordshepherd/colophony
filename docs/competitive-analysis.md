# Competitive Analysis & Feature Research

> **Purpose:** Comprehensive research into submissions management platforms and adjacent tools, to inform feature prioritization conversations for Colophony.
>
> **Generated:** 2026-02-10
>
> **Interview completed:** 2026-02-10
>
> **How to use this document:** Sections 2-7 contain competitive research, feature matrices, and gap analysis. Section 8 contains the original interview questions. **Section 9 contains all decisions from the interview** — this is the actionable output for roadmap planning.

---

## Table of Contents

1. [Colophony Current State](#1-colophony-current-state)
2. [Primary Competitors](#2-primary-competitors)
   - [Submittable](#21-submittable)
   - [Moksha](#22-moksha)
   - [Dapple](#23-dapple)
   - [Duosuma (by Duotrope)](#24-duosuma-by-duotrope)
3. [Submitter-Side Tools](#3-submitter-side-tools)
   - [Duotrope](#31-duotrope)
   - [The Submission Grinder](#32-the-submission-grinder)
   - [Chill Subs](#33-chill-subs)
4. [Adjacent Tools](#4-adjacent-tools)
   - [Literary/Creative Platforms](#41-literarycreative-platforms)
   - [Contest/Award Platforms](#42-contestaward-platforms)
   - [Grant Management Systems](#43-grant-management-systems)
   - [Academic/Peer Review Systems](#44-academicpeer-review-systems)
   - [Creative Industry Tools](#45-creative-industry-tools)
5. [Pricing Models Across the Landscape](#5-pricing-models-across-the-landscape)
6. [Feature Comparison Matrix](#6-feature-comparison-matrix)
7. [Gap Analysis](#7-gap-analysis)
8. [Interview Questions](#8-interview-questions)
9. [Interview Results & Decisions](#9-interview-results--decisions)

---

## 1. Colophony Current State

### Summary

Colophony is a **production-ready MVP** multi-tenant submissions management platform for creative arts magazines. Built with NestJS + Next.js + PostgreSQL RLS. 308 unit tests + 65 E2E tests. Docker Compose deployment.

### Implemented Features

| Category           | Coverage | Key Capabilities                                                                                                                                |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication** | 85%      | Email/password, JWT + refresh tokens, email verification, 3 roles (Admin/Editor/Reader)                                                         |
| **Submissions**    | 90%      | Full lifecycle (Draft -> Submitted -> Under Review -> Accepted/Rejected/Hold/Withdrawn), submission periods, file attachments, history tracking |
| **File Uploads**   | 95%      | Resumable uploads (tus), ClamAV virus scanning, 17 MIME types, 50MB/file, 200MB/submission                                                      |
| **Payments**       | 75%      | Stripe Checkout, webhook idempotency, payment status tracking                                                                                   |
| **GDPR**           | 95%      | Data export (ZIP), erasure requests, consent management (6 types), retention policies, DSAR tracking                                            |
| **Audit Logging**  | 100%     | 30+ audited actions, before/after values, IP tracking, CSV export                                                                               |
| **Multi-Tenancy**  | 100%     | PostgreSQL RLS, org context isolation, cross-org prevention                                                                                     |
| **Email**          | 60%      | SMTP via Nodemailer, verification emails only                                                                                                   |
| **Frontend**       | 85%      | Auth pages, submission list/create/edit/detail, editor dashboard, settings, payment flow                                                        |

### Known Gaps / Stubs

- Password reset (schema ready, no endpoint)
- OAuth/social auth (UserIdentity table prepared, no handlers)
- Full-text search (search_vector indexed, not queried)
- Submission period date enforcement (not validated at submit time)
- Max submissions per period enforcement
- Bulk status transitions
- Comments/reviewer feedback system
- Org member invitations
- Self-serve org creation
- Payment receipts/invoices
- Refund UI
- Email provider integration (SendGrid/Mailgun)
- Advanced email templates

---

## 2. Primary Competitors

### 2.1 Submittable

**URL:** [submittable.com](https://submittable.com) | **Founded:** 2010 (originally Submishmash) | **HQ:** Missoula, MT

**Market position:** The dominant player. 4.8/5 on Capterra (389 reviews). Over $2.5B in funds disbursed. 3,500+ government agencies. Has expanded far beyond literary submissions into grants, CSR, and employee engagement.

#### Pricing

| Tier          | Price                | Users        | Key Differentiators                                    |
| ------------- | -------------------- | ------------ | ------------------------------------------------------ |
| CLMP Plan     | $29/mo or $299/yr    | Unrestricted | For Community of Literary Magazines members            |
| Basic/Starter | ~$84/mo              | Up to 5      | Customizable forms, basic reporting                    |
| Pro           | ~$799/mo             | Up to 20-25  | Advanced reporting, CRM integrations, automated review |
| Enterprise    | Custom (~$1,499+/mo) | 50+          | Funds distribution, white-labeling, SSO                |

Non-profit/arts publishers get 50% discount with coupon code "NonProfitArtLit."

**Submission fees charged to submitters:** $0.99 + 5% per paid submission (minimum $2 total).

#### Standout Features

**Form System:**

- Drag-and-drop form builder with 12+ field types and conditional branching
- 6 form types: Initial, Eligibility (pre-screening), Additional (follow-up), Internal, Review (rubrics), Reference (referee completes independently)
- Request Forms (self-service, criteria-gated) on Pro+
- 70+ supported file types, up to 400MB/file, 800MB/submission
- Auto-labels based on form responses
- Draft auto-save; organizations can message submitters about incomplete drafts

**Review Workflow:**

- Yes/Maybe/No voting with aggregate scores
- Custom scoring rubrics with qualitative and quantitative fields
- Multi-stage review with configurable steps per stage (Pro+)
- Automated scoring across ALL form types (Pro+)
- Blind review (configurable per project)
- Reviewer assignment (automatic or manual)
- Side-by-side review interface (application + scoring rubric)
- Conditional routing based on form scores (Pro+)
- Labels for tagging, filtering, and bulk actions

**Communication:**

- In-app threaded messaging per submission
- Response templates with merge fields (submitter name, project, org, etc.)
- Auto-response on submission receipt
- Bulk messaging
- Draft submission messaging (remind submitters to complete)
- Status change notifications

**Payments & Funds:**

- Required, optional, or tiered submission fees via Stripe/PayPal
- Fee waivers, discount codes, multi-currency
- Funds distribution to awardees (Enterprise): electronic, check, or prepaid debit, with tranche scheduling

**Team Management:**

- 5-tier permission system (Basic Reviewer -> Full Admin)
- Custom roles (Enterprise, released 2025)
- Bulk team management via API

**Submitter Experience:**

- Free portal with status tracking, message history, personal notes, PDF downloads
- **Discover Marketplace:** 5,700+ open opportunities across 150+ categories (network effect)
- **Universal Submission Tracker:** Track submissions to ANY platform, not just Submittable
- Collaboration on submissions (multiple users, separate accounts)
- Mobile app (iOS)

**Integrations:**

- DocuSign, Salesforce, Mailchimp, Slack, Google Drive, WordPress, QuickBooks
- Zapier (5,000+ apps)
- REST API v4 (read/write)
- SAML SSO (Okta, CAS, Shibboleth, etc.) on Enterprise

**Compliance:**

- SOC 2 Type 2
- GDPR (DPA available, custom consent checkboxes)
- Encryption in transit and at rest

**Branding:**

- Basic: header image, logo, colors
- Enterprise: custom CSS, white-labeling, custom domain, multi-language translation

#### Known Weaknesses

- Cost prohibitive for small orgs without CLMP discount
- Reporting feels limited for complex data pulls
- No batch delete of submissions
- Training is difficult across different permission levels (admins can't easily preview team member views)
- Support quality reportedly declining
- Has drifted away from literary/creative focus toward enterprise/grants/CSR

---

### 2.2 Moksha

**URL:** [moksha.io](https://moksha.io) | **Created:** 2011 by Matthew Kressel | **One-person operation**

**Market position:** The specialist for speculative fiction magazines. Notable clients include Reactor (Tor.com), Fantasy & Science Fiction, Strange Horizons, Lightspeed, Nightmare, Uncanny Magazine, Escape Pod, and Best American Science Fiction & Fantasy.

**Philosophy:** Adheres to Yog's Law -- writers should never pay to submit. Moksha will never support submission fees.

#### Pricing

| Detail      | Info                                                                 |
| ----------- | -------------------------------------------------------------------- |
| Tier 1      | Up to 3 publications, up to 6 submission types                       |
| Tier 2      | Up to 6 publications, up to 10 submission types                      |
| Tier 3      | Unlimited publications, unlimited submission types                   |
| Billing     | Monthly, bi-annual, or annual (~$50/mo estimated; ~$750/yr reported) |
| All plans   | Unlimited submissions, unlimited users, ALL features                 |
| Bulk email  | $0.01/email                                                          |
| Author cost | Always free                                                          |

**Key differentiator:** No feature gating -- tiers only differ by publication/submission type counts.

#### Standout Features

**Submission Intake:**

- Multiple submission types per publication (Short Fiction, Flash, Poetry, etc.)
- Custom guidelines pages at `publisher.moksha.io`
- Scheduled reading periods with auto-open/close
- Submission limits (auto-close at count) and throttling (N-day wait between submissions)
- **No account required for authors** -- submit and get a unique status URL via email
- **AI content management:** Authors must affirm AI usage; publishers can block AI-affirmed submissions, or auto-tag them for filtering
- Password-protected submission forms (invite-only periods)
- Multi-language forms (English, Spanish, Arabic beta)

**Editorial Workflow:**

- **Claiming system:** Readers claim submissions from unclaimed queue (prevents duplicate work)
- Rating/scoring with automatic threshold-based forwarding to second readers
- **Round-robin assignment** with drag-and-drop ordering
- Status-based forwarding rules (configurable chains)
- Submission timeout (auto-return idle-claimed items to queue)
- Blind review with Alt+N hotkey toggle
- Reader comments (visible only to executive editor until released)
- Hold and Revision Requested statuses
- Bulk reject and bulk assignment changes
- Customizable columns, tagging with colors, bookmarked search views
- Keyboard hotkeys throughout (Alt+R reject, etc.)
- Queue size alerts

**Communication:**

- One-click form letters (pre-configured templates)
- **Delayed/scheduled responses** (send at future date/time)
- Bulk email ($0.01/email)
- Per-reader new submission notifications (with optional manuscript attachment)
- Status change notifications
- Daily activity summary emails
- Kindle forwarding (read manuscripts on Kindle via email)

**Submitter Experience:**

- No account needed
- Status page with queue position number
- Author comments on submissions (if enabled)
- Self-service withdrawal
- Open Publications directory at moksha.io/open-publications/

**Data & Security:**

- Triple-redundant encrypted storage
- Permanent archive of all submissions
- One-click full data export

#### Known Weaknesses

- No submission fee support (philosophical choice, but limits market)
- No analytics dashboard (email summaries and raw export only)
- No API, webhooks, or integrations (closed system)
- No custom domains (subdomain only)
- No GDPR compliance features (no data export/erasure for submitters, no consent management)
- No audit logging
- Basic UI
- Single-developer risk
- Speculative fiction focus (not broadly positioned)

---

### 2.3 Dapple

**URL:** [dapplehq.com](https://dapplehq.com) | **Founded:** London, UK | **Founders:** Oz Osbaldeston, Ally Mackenzie

**Market position:** Modern alternative to Submittable, focused on creative arts. "Built by creatives, for creatives." Positioned around "championing the creator" experience.

#### Pricing

| Detail           | Info                                                     |
| ---------------- | -------------------------------------------------------- |
| Starting price   | ~$35/month                                               |
| Billing          | Monthly (no lock-ins) or annual (2 months free)          |
| Free account     | Yes, free to explore; upgrade to go live                 |
| Transaction fees | 3.5% + $0.65 per paid submission (on top of Stripe fees) |
| Payouts          | Immediate via Stripe Connect                             |
| CLMP discount    | Up to 35% off + 5,000 free submissions/year              |

#### Standout Features

**Submission Intake:**

- Drag-and-drop form builder with industry-specific templates
- **AI-powered Smart Form Generator** (describe what you need, it generates the form)
- Form versioning (update mid-cycle without losing historical data)
- Any file type, any size (no restrictions mentioned)
- **Pages:** Branded landing pages displaying multiple open opportunities, with customizable URLs, backgrounds, imagery, and terms
- Project visibility controls, date range scheduling

**Editorial Workflow:**

- Configurable unlimited stages with bespoke automations per stage
- **Kanban board** (drag-and-drop between stages)
- Review panels with per-project/per-stage permissions
- Scoring, voting, and comments
- Blind review
- Real-time admin dashboard for scores/decisions
- Dedicated reviewer dashboard (any device)
- Automated stage transitions
- Bulk actions (move, archive, message, tag)
- Submission and creator tags (two taxonomies)
- Duplicate detection via creator profiles

**Communication:**

- Customizable message templates
- Bulk messaging
- Automated stage-change notifications
- Real-time status updates for creators

**Payments:**

- Stripe Connect (immediate payouts)
- Low transaction fees (claimed ~50% lower than competitors)

**Analytics:**

- Central dashboard across all projects
- Stage analytics with visual graphs
- Date range filtering
- CSV export

**Team Management:**

- Role-based permissions
- Multi-team and multi-organization support
- Panel assignment per project/stage

**Submitter Experience:**

- Creator profiles with submission history
- Status tracking and withdrawal
- Branded, responsive forms
- Branded landing Pages for discovery

#### Known Weaknesses

- Limited/unclear API and integration story
- No confirmed webhook support
- Newer platform with smaller user base
- No self-hosted option
- No confirmed white-labeling or custom domains
- GDPR privacy policy exists but no explicit DSAR/erasure tooling

---

### 2.4 Duosuma (by Duotrope)

**URL:** [duotrope.com/duosuma](https://duotrope.com/duosuma/) | **Parent:** Duotrope (est. 2005)

**Market position:** Duotrope's publisher-facing submission management system. The only platform operating on BOTH sides of the marketplace (writer discovery + publisher management).

#### Pricing

**Usage-based:** $0.09/submission (no subscription). Volume discounts + Gold Star Program (25% off).
**Commission:** $0.10 on fee-based submissions. No commission on tips.

A magazine receiving 100 free submissions/month pays ~$108/year. Dramatically cheaper than Submittable.

#### Standout Features

- Smart Submission Periods (open/close dates, recurring)
- Automatic submission assignment to team members
- Response templates and bulk actions
- Configurable rating systems: Accept/Decline, Yes/No/Maybe, 5-star, or letter grades
- Custom questions for submitters
- Submission fee collection and "tip jar"
- Target response time with auto-reminders and reassignment
- Team management with role-based permissions
- AI/bot spam protections
- **Integration with Duotrope:** Submissions automatically appear in the writer's Duotrope tracker (two-sided marketplace advantage)

#### Known Weaknesses

- Relatively new publisher-side product
- Less feature-rich than Submittable's full platform
- Dependent on Duotrope ecosystem for network effect

---

## 3. Submitter-Side Tools

These are writer-facing tools, not publisher-facing. They're relevant because they sit on the other side of the marketplace and influence submitter expectations.

### 3.1 Duotrope

**URL:** [duotrope.com](https://duotrope.com) | **Price:** $5/mo or $50/yr

- 7,647+ active publishers/agents across 40+ countries
- 20+ search filters including Smart Search with fuzzy matching
- Submission tracker with color-coded status and response time predictions
- **Statistics:** Acceptance rates, response times, Top 100 Most Challenging/Approachable/Fastest lists
- **2,275+ editor interviews** (no competitor matches this)
- Theme/deadline calendar
- Submission goals (monthly/annual targets)
- Cross-publication writer tracking (where do writers who publish in Journal X also publish?)

**Notable:** Duotrope claims copyright over user-submitted tracking data, preventing export to other systems. This was widely criticized.

### 3.2 The Submission Grinder

**URL:** [thegrinder.diabolicalplots.com](https://thegrinder.diabolicalplots.com) | **Price:** Free (donation-supported)

- 18,887 total markets (3,226 currently open)
- **Piece Priority system:** Mark piece-market pairs as Preferred/Neutral/Unsuitable for smart matching
- Response time histograms (visual distribution charts, more detailed than Duotrope's averages)
- Follow/notification system for markets (alerts on open/close)
- Private notes on markets
- Genre fiction strength (SFF/horror roots)
- 13,194 users, 768,888 submissions tracked
- Volunteer-maintained, one-person project

### 3.3 Chill Subs

**URL:** [chillsubs.com](https://chillsubs.com) | **Price:** Mostly free (premium available)

- 4,235 publishing opportunities across 3,000+ magazines and 1,200+ contests
- **"Vibe filter"** for choosing between prestigious and casual publications
- Submission tracker with Table and Board views, CSV export
- Deadline calendar
- Writer profiles with auto-synced publication credits
- Cover letter generator
- 69,000+ registered writers
- Community-focused, reimagining literary community

---

## 4. Adjacent Tools

### 4.1 Literary/Creative Platforms

**Subfolio** ([subfol.io](https://subfol.io/)) -- $10/mo starting

- Kanban board for submission workflow
- Integrated chat/discussion tied to scoring
- Part of broader Demon ecosystem (orders, renewals, royalties)
- Portfolio-based submission
- 8,800+ submissions in first season with 14 organizations (including AGNI, One Story)

**Submission Manager (CLMP)** -- $200 one-time/annual

- Reading period management with auto-prevention of out-of-period submissions
- Customizable branding
- Self-hosted option available
- Aging system, considered "janky" by users -- replacement opportunity

**Literistic** ([literistic.com](https://home.literistic.com/)) -- ~$40/yr

- Curated monthly email of 60+ opportunities filtered to "best 20%"
- Personalized by genre, compensation, and fee preferences

### 4.2 Contest/Award Platforms

**OpenWater** ([getopenwater.com](https://getopenwater.com)) -- $5,100-$6,900/yr

- Awards website builder (auto-generated public-facing site from program)
- 65+ integrations (AMS, CRM, payment gateways)
- Multi-round blind judging with custom scoring

**Award Force** ([awardforce.com](https://awardforce.com)) -- ~$2,200/yr

- Four distinct judging modes (sequential or parallel)
- Criteria weighting in scoring rubrics
- **Entries editable after submission until deadline**
- Multi-currency with early bird/late entry pricing and discount codes
- 30+ language translations

**Judgify** ([judgify.me](https://judgify.me)) -- Free plan + $500/event Pro

- Public voting module alongside judging
- Custom scoring formulas
- Per-event pricing model
- ROI analysis reporting

### 4.3 Grant Management Systems

**Fluxx** ([fluxx.io](https://fluxx.io)) -- Custom pricing

- **Grantelligence:** 7,000+ dynamic visualizations, drag-and-drop dashboards for non-technical users
- Branded grantee portal for post-award coordination
- End-to-end lifecycle from announcement through payments

**OpenGrants** ([opengrants.io](https://opengrants.io))

- AI-powered grant matching based on organization profile
- AI grant writing agent
- Expert consultant network

**SmarterSelect** ([smarterselect.com](https://smarterselect.com))

- Granular anonymization (per-question, per-section, per-page)
- Pre-qualification screening
- Automatic matching of candidates to eligible programs
- Zapier integration (2,000+ apps)
- Average support response under 1 hour

### 4.4 Academic/Peer Review Systems

**ScholarOne** (Clarivate) -- Enterprise

- Gold standard configurable workflow engine
- Conflict-of-interest and disclosure management
- ORCID/Crossref integration
- 25+ years in market, 3M+ submissions/year

**Editorial Manager** (Aries Systems) -- Enterprise

- **ReviewerCredits:** Reward system for peer reviewers
- Transfer capability between platforms (rejected piece can transfer to another journal with author consent)
- SciScore integration for automated methods review

**Open Journal Systems (OJS)** -- Free, open source

- **Closest philosophical match to Colophony's self-hosted model**
- Plugin architecture for extensibility
- Multi-journal per installation
- Author-suggested reviewers
- Multilingual support (unlimited languages)
- Used by thousands of journals worldwide

**Scholastica** ([scholasticahq.com](https://scholasticahq.com))

- Integrated email/discussion saved alongside manuscripts
- Real-time analytics at journal AND editor level
- Article production service ($7/500 words)

**Manuscript Manager** ([manuscriptmanager.com](https://manuscriptmanager.com))

- **AI reviewer finder** (match submissions to best-fit reviewer)
- Pre-paid credit packs (no startup fees)
- Plagiarism checking (iThenticate)

### 4.5 Creative Industry Tools

**FilmFreeway** ([filmfreeway.com](https://filmfreeway.com))

- 12,000+ festivals, 2M+ filmmakers
- Commission-free for non-fee events; 12% on paid entries
- $100 activation fee as quality gate against fraud
- Indefinite archival storage

**Zealous** ([zealous.co](https://zealous.co)) -- ~$29/mo

- **No commission on payments** (Stripe direct)
- Live dashboards for program performance
- Unlimited programs, file storage, and drafts on all plans

**Coverfly** (discontinued Sept 2025)

- **Coverfly Score:** Cross-platform composite quality metric (10 evaluations of 8/10 rank higher than 1 evaluation of 10/10)
- **Red List:** Leaderboard of top-scoring projects
- Industry Dashboard for agents/managers to discover writers
- Cautionary tale: shutdown despite ~2,000 industry users

**ArtCall** ([artcall.org](https://artcall.org))

- Embeddable submission system on any website
- Automatic image processing (3 sizes per upload)
- QR-based physical exhibition check-in

**OESS** ([oess.org.uk](https://oess.org.uk)) -- Pay-per-use only

- **Free online exhibition generated from accepted submissions**
- Entries editable during open call period
- Public voting capability

**ShowSubmit** ([showsubmit.com](https://showsubmit.com))

- Automatic file standardization (resize, rename)
- **Hosted gallery** with filtering, award display, sold-work marking
- Monthly marketing email to artist community

**EntryThingy** ([entrythingy.com](https://entrythingy.com)) -- $3/submission token

- **One-line embed** for displaying accepted work on any website
- Blind judging with real-time vote tracking

---

## 5. Pricing Models Across the Landscape

| Model                              | Examples                                                                                             | Colophony Applicability                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Flat monthly subscription**      | Submittable ($29-$1,499+/mo), Dapple ($35/mo), Moksha (~$50/mo), Subfolio ($10/mo), Zealous ($29/mo) | Predictable revenue; standard SaaS model                    |
| **Per-submission / usage-based**   | Duosuma ($0.09/sub), EntryThingy ($3/token), Manuscript Manager (credit packs)                       | Attractive to tiny magazines; aligns cost with usage        |
| **Commission on fees**             | FilmFreeway (12%), Submittable (5% + $0.99), Dapple (3.5% + $0.65)                                   | Only costs when org earns; good for fee-charging magazines  |
| **Dual model (choose)**            | CaFE (pay-per-entry OR flat-rate with calculator)                                                    | Serves both small and large orgs                            |
| **Pay-per-use (no subscription)**  | OESS, Manuscript Manager                                                                             | Maximum flexibility, zero commitment                        |
| **Free + donations**               | The Grinder, Chill Subs                                                                              | Not viable as primary business model                        |
| **Tiered by volume, not features** | Moksha (all features on all plans, tier by publication count)                                        | Builds trust; simple to understand                          |
| **Self-hosted (free software)**    | OJS, Colophony (current)                                                                             | Zero ongoing cost for the org; monetize via support/hosting |

---

## 6. Feature Comparison Matrix

### Core Submission Features

| Feature             | Colophony                       | Submittable                        | Moksha                         | Dapple                       | Duosuma                  |
| ------------------- | ------------------------------- | ---------------------------------- | ------------------------------ | ---------------------------- | ------------------------ |
| Form builder        | Basic                           | Advanced (12+ types, branching)    | Structured fields              | Drag-and-drop + AI generator | Custom questions         |
| File uploads        | Resumable (tus), 50MB, 17 types | 70+ types, 400MB                   | 6 doc types                    | Any type/size                | Standard                 |
| Virus scanning      | ClamAV                          | Not documented                     | No                             | No                           | No                       |
| Reading periods     | Schema ready, not enforced      | Yes (projects)                     | Auto-open/close, limits        | Date range scheduling        | Smart Submission Periods |
| Submission fees     | Stripe Checkout                 | Stripe/PayPal + waivers/coupons    | Never (philosophy)             | Stripe Connect               | Yes + tip jar            |
| Draft submissions   | Yes                             | Yes + org can message about drafts | No                             | Yes                          | Not documented           |
| Categories/types    | Single type                     | Project-based with categories      | Multiple types per publication | Multiple projects            | Multiple projects        |
| AI content handling | No                              | No                                 | Block/filter/tag               | No                           | AI/bot protection        |

### Editorial Workflow

| Feature            | Colophony                       | Submittable                   | Moksha                        | Dapple                         | Duosuma                                  |
| ------------------ | ------------------------------- | ----------------------------- | ----------------------------- | ------------------------------ | ---------------------------------------- |
| Status transitions | 7 statuses, allowed transitions | 5 statuses                    | 8+ statuses                   | Unlimited custom stages        | Standard                                 |
| Scoring/rating     | No                              | Yes/Maybe/No + custom rubrics | Numeric rating, auto-forward  | Scoring + voting               | Multiple systems (5-star, letter, Y/N/M) |
| Blind review       | No                              | Yes                           | Yes (hotkey toggle)           | Yes                            | Not documented                           |
| Multi-stage review | No                              | Yes (Pro+)                    | Rating threshold forwarding   | Kanban stages with automations | Not documented                           |
| Auto-assignment    | No                              | Yes                           | Round-robin                   | Panel assignment               | Auto-assignment                          |
| Bulk actions       | No                              | Yes (messaging, status)       | Bulk reject, bulk reassign    | Move, archive, message, tag    | Bulk actions                             |
| Reviewer dashboard | Editor dashboard                | Side-by-side review           | Claiming queue                | Dedicated dashboard            | Dashboard                                |
| Keyboard shortcuts | No                              | No                            | Yes (extensive)               | No                             | No                                       |
| Submission timeout | No                              | No                            | Yes (auto-return idle claims) | No                             | Auto-reminders + reassignment            |

### Communication

| Feature            | Colophony         | Submittable                           | Moksha                       | Dapple                 | Duosuma            |
| ------------------ | ----------------- | ------------------------------------- | ---------------------------- | ---------------------- | ------------------ |
| Email templates    | Verification only | Rich templates with merge fields      | One-click form letters       | Customizable templates | Response templates |
| In-app messaging   | No                | Threaded per submission               | Author comments (if enabled) | Not documented         | Not documented     |
| Bulk messaging     | No                | Yes                                   | Yes ($0.01/email)            | Yes                    | Bulk actions       |
| Auto-notifications | No                | Status changes, receipts              | Status changes, daily digest | Stage transitions      | Reminders          |
| Scheduled sending  | No                | No                                    | Yes (send later)             | No                     | No                 |
| Draft reminders    | No                | Yes (message about incomplete drafts) | No                           | No                     | No                 |

### Submitter Experience

| Feature              | Colophony        | Submittable               | Moksha                         | Dapple                        | Duosuma                        |
| -------------------- | ---------------- | ------------------------- | ------------------------------ | ----------------------------- | ------------------------------ |
| Account required     | Yes              | Yes (free)                | No                             | Yes                           | Via Duotrope                   |
| Status tracking      | Yes (via portal) | Detailed portal with tabs | Status URL with queue position | Status tracking               | Auto-syncs to Duotrope tracker |
| Submission history   | Yes              | Yes + universal tracker   | Via status URL                 | Creator profiles with history | Via Duotrope                   |
| Discover/marketplace | No               | 5,700+ opportunities      | Open Publications directory    | Pages (branded listings)      | Duotrope database (7,647+)     |
| Mobile app           | No               | iOS app                   | No                             | Responsive                    | No                             |
| Collaboration        | No               | Multi-user submissions    | No                             | No                            | No                             |
| Portfolio/profile    | No               | Basic profile             | No                             | Creator profiles              | Duotrope profile               |

### Team & Organization

| Feature     | Colophony               | Submittable                   | Moksha                    | Dapple              | Duosuma    |
| ----------- | ----------------------- | ----------------------------- | ------------------------- | ------------------- | ---------- |
| Roles       | 3 (Admin/Editor/Reader) | 5 tiers + custom (Enterprise) | Per-user permission flags | Role-based + panels | Role-based |
| Multi-org   | Yes (multi-tenant RLS)  | Per-org accounts              | Multiple publications     | Multi-org support   | Per-org    |
| Team seats  | Unlimited               | Plan-limited (5-50+)          | Unlimited                 | Plan-dependent      | Unlimited  |
| Invitations | Stub                    | Yes + bulk                    | Direct add                | Yes                 | Yes        |

### Analytics & Reporting

| Feature           | Colophony              | Submittable               | Moksha               | Dapple                          | Duosuma        |
| ----------------- | ---------------------- | ------------------------- | -------------------- | ------------------------------- | -------------- |
| Dashboard         | Submission list only   | Visual pipeline dashboard | No (email summaries) | Central analytics dashboard     | Dashboard      |
| Custom reports    | Audit log export (CSV) | Standard + impact reports | No                   | Stage analytics, date filtering | Not documented |
| Acceptance rates  | No                     | No                        | No                   | No                              | No             |
| Reviewer workload | No                     | Assignment counts         | No                   | Real-time review dashboard      | Not documented |

### Compliance & Security

| Feature              | Colophony                                  | Submittable              | Moksha         | Dapple              | Duosuma        |
| -------------------- | ------------------------------------------ | ------------------------ | -------------- | ------------------- | -------------- |
| GDPR                 | Full (export, erasure, consent, retention) | DPA + consent checkboxes | Not documented | Privacy policy only | Not documented |
| Audit logging        | 30+ actions with before/after              | Not detailed             | No             | No                  | No             |
| SOC 2                | No                                         | Yes (Type 2)             | No             | No                  | No             |
| RLS/tenant isolation | PostgreSQL RLS (FORCE)                     | Not documented           | Not documented | Not documented      | Not documented |
| Self-hosted          | Yes (Docker Compose)                       | No                       | No             | No                  | No             |

### Integrations

| Feature           | Colophony               | Submittable       | Moksha | Dapple           | Duosuma        |
| ----------------- | ----------------------- | ----------------- | ------ | ---------------- | -------------- |
| API               | tRPC (internal)         | REST API v4       | None   | Limited/unclear  | Not documented |
| Webhooks          | Internal (tusd, Stripe) | Via Zapier        | None   | Not confirmed    | Not documented |
| Zapier            | No                      | Yes (5,000+ apps) | No     | No               | No             |
| SSO               | No                      | SAML (Enterprise) | No     | No               | No             |
| Payment processor | Stripe                  | Stripe + PayPal   | N/A    | Stripe Connect   | Stripe         |
| Embeddable        | No                      | WordPress         | No     | Embeddable links | Not documented |

---

## 7. Gap Analysis

### 7.1 Features Competitors Have That Colophony Lacks

**High-impact gaps (multiple competitors have these):**

| Gap                                   | Who Has It                           | Complexity  | Notes                                                      |
| ------------------------------------- | ------------------------------------ | ----------- | ---------------------------------------------------------- |
| **Scoring/rating system**             | Submittable, Moksha, Dapple, Duosuma | Medium      | Core editorial workflow feature; every competitor has this |
| **Blind/anonymous review**            | Submittable, Moksha, Dapple          | Low-Medium  | Hide author info from reviewers; toggle per project        |
| **Email templates with merge fields** | Submittable, Moksha, Dapple, Duosuma | Medium      | Accept/reject/hold templates; form letters                 |
| **Bulk actions**                      | Submittable, Moksha, Dapple          | Medium      | Bulk reject, bulk status change, bulk message              |
| **Customizable form builder**         | Submittable, Dapple                  | High        | Drag-and-drop field types, conditional logic               |
| **Analytics dashboard**               | Submittable, Dapple, Zealous, Fluxx  | Medium-High | Pipeline visualization, stage metrics, time-to-decision    |
| **Reviewer assignment**               | Submittable, Moksha, Dapple, Duosuma | Medium      | Auto-assign, round-robin, panel-based                      |
| **Discover/marketplace**              | Submittable, Duotrope, Chill Subs    | High        | Two-sided platform; network effects                        |
| **Multi-stage review**                | Submittable, Dapple                  | Medium-High | Sequential stages with different rules per stage           |
| **Custom branding**                   | Submittable, Dapple, OESS            | Medium      | Logo, colors, custom CSS, branded pages                    |

**Medium-impact gaps (fewer competitors, but notable):**

| Gap                                 | Who Has It          | Complexity | Notes                                            |
| ----------------------------------- | ------------------- | ---------- | ------------------------------------------------ |
| **AI content detection/management** | Moksha              | Low-Medium | Author affirmation + block/filter/tag            |
| **Kanban board view**               | Dapple, Subfolio    | Medium     | Visual drag-and-drop stage management            |
| **Scheduled email sending**         | Moksha              | Low        | Send responses at a future date/time             |
| **Submission throttling**           | Moksha              | Low        | Force N-day wait between submissions             |
| **No-account submission**           | Moksha              | Medium     | Status via unique URL, no registration needed    |
| **Form versioning**                 | Dapple              | Medium     | Update forms mid-cycle without data loss         |
| **Creator profiles**                | Dapple              | Medium     | Historical record of all submissions per person  |
| **Reading period enforcement**      | Moksha, Submittable | Low        | Auto-open/close, block out-of-period submissions |

### 7.2 Colophony Advantages Over Competitors

| Advantage                        | Details                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL RLS multi-tenancy** | No competitor documents database-level tenant isolation. Most rely on application-level filtering.                  |
| **GDPR-first compliance**        | Full data export, erasure, consent management, retention policies, DSAR tracking. No competitor matches this depth. |
| **Comprehensive audit logging**  | 30+ actions with before/after values, IP tracking. Competitors lack this entirely or have basic activity logs.      |
| **Resumable file uploads (tus)** | Chunked, resumable uploads for large files. No competitor mentions this.                                            |
| **Virus scanning (ClamAV)**      | File scanning before production. No competitor documents this.                                                      |
| **Self-hosted deployment**       | Docker Compose, no vendor lock-in. Only OJS (academic) offers comparable self-hosting.                              |
| **Transactional outbox pattern** | Reliable event processing. Enterprise-grade pattern not found in competitors.                                       |
| **Stripe webhook idempotency**   | Deduplication via processed flag. Proper implementation not documented by competitors.                              |
| **Open source potential**        | Self-hosted model could capture the "Submittable is too expensive" market segment.                                  |

### 7.3 Biggest Strategic Opportunities

1. **Self-hosted Submittable alternative:** No one offers this for literary magazines. OJS proves the model works for academia.
2. **Post-acceptance workflow:** Most platforms end at accept/reject. The publication pipeline (contracts, payments to contributors, copyediting, issue assembly) is underserved.
3. **Affordable all-in-one:** Subfolio ($10/mo) is leading on price, but Colophony's self-hosted model could be even cheaper at scale.
4. **Writer-side discovery + publisher-side management:** No single platform excels at both sides. Building both creates a moat.
5. **Multi-magazine organizations:** University presses and literary orgs running multiple journals need multi-tenant by design -- exactly what Colophony already provides.

---

## 8. Interview Questions

The following questions are organized by feature area. Each section starts with context from the competitive research, then poses prioritization questions.

### 8.1 Editorial Workflow & Review

**Context:** Every competitor offers scoring/rating, blind review, and reviewer assignment. These are table-stakes features that Colophony currently lacks. Moksha has a particularly elegant auto-forward-on-rating-threshold system. Dapple uses a kanban board.

1. **Scoring system:** What kind of scoring do you envision? Simple (Yes/Maybe/No like Submittable), numeric (like Moksha's rating average), multi-criteria rubrics, or configurable per-org?

2. **Blind review:** Is anonymous review important for your target users? Should it be per-project toggleable? Should it hide just names, or also cover letters and bios?

3. **Reviewer assignment:** How should submissions get to reviewers? Manual assignment only, auto round-robin (Moksha), panel-based (Dapple), or configurable?

4. **Multi-stage review:** Do you want a simple two-tier model (first reader -> editor), full configurable pipeline stages (Dapple), or auto-forward based on score thresholds (Moksha)?

5. **Kanban board:** Would a visual drag-and-drop board (like Dapple/Subfolio) be a valuable addition to the current list view, or is a list/table the right primary interface?

6. **Bulk actions:** Which bulk operations are highest priority? Bulk reject, bulk status change, bulk reassign, bulk message, or all?

7. **Submission timeout:** Should idle-claimed submissions auto-return to the queue after N days (Moksha pattern)?

8. **Keyboard shortcuts:** Moksha has extensive hotkeys for power users. Is this a priority for your target audience?

### 8.2 Communication & Email

**Context:** Colophony currently only sends verification emails. Every competitor has rich template systems with merge fields. Moksha has scheduled sending. Submittable can message submitters about incomplete drafts.

9. **Email templates:** What response types are most needed? Accept, reject, hold, revision request, reading period open/closed? Should they support merge fields (submitter name, submission title, etc.)?

10. **In-app messaging:** Should Colophony support threaded messaging per submission (Submittable) or is email sufficient?

11. **Automated notifications:** Which events should trigger notifications? New submission, status change, review complete, reading period open/close?

12. **Scheduled sending:** Is the ability to schedule responses for a future date (Moksha) important? Use case: batch rejection/acceptance notices.

13. **Email provider:** The roadmap mentions SendGrid. Is this the preferred provider, or should the system be provider-agnostic?

### 8.3 Submission Intake & Forms

**Context:** Submittable has the most advanced form builder (12+ types, branching, conditional logic). Dapple has an AI form generator. Moksha is simpler but has AI content management.

14. **Form builder:** How customizable should submission forms be? Fixed fields only (current), admin-configurable fields, or full drag-and-drop builder with conditional logic?

15. **AI content policy:** Moksha lets publishers block/filter/tag AI-generated submissions based on author self-affirmation. Is AI content management relevant for your target market?

16. **Submission types:** Should organizations define multiple submission categories (e.g., Fiction, Poetry, Flash) with different rules/forms per type?

17. **Reading period enforcement:** The schema has submission periods with dates but they're not enforced. Should the system auto-open/close and block out-of-period submissions?

18. **Submission limits and throttling:** Should there be per-period limits (auto-close at N submissions) and/or per-author throttling (wait N days between submissions)?

19. **No-account submissions:** Moksha doesn't require authors to create accounts. Is reducing submitter friction worth the tradeoff in tracking/communication?

20. **File types:** Currently 17 MIME types. Submittable supports 70+. Should Colophony expand, and if so, what types matter (audio? video? 3D models)?

### 8.4 Submitter Experience & Discovery

**Context:** Submittable's Discover marketplace (5,700+ opportunities) creates network effects. Duotrope/Duosuma's two-sided model is a moat. Chill Subs has 69,000 registered writers.

21. **Submitter portal:** How rich should the submitter experience be? Current basic status tracking, or expand to include submission history, profiles, and cross-org tracking?

22. **Discovery/marketplace:** Should Colophony have a public-facing directory of participating magazines' open calls? This is a major strategic decision -- it could create network effects but adds significant scope.

23. **Creator profiles:** Dapple tracks all submissions per creator. Should Colophony build creator profiles that persist across submissions to help editors see a submitter's history?

24. **Branded landing pages:** Dapple's "Pages" feature lets orgs create branded multi-opportunity landing pages. Is this valuable, or do magazines prefer their own websites?

25. **Mobile experience:** Submittable has an iOS app. Is mobile access important for submitters, reviewers, or both?

### 8.5 Payments & Pricing

**Context:** Pricing models range from flat subscriptions to per-submission to commission-only. Moksha philosophically opposes submission fees. Dapple claims 50% lower transaction fees than competitors.

26. **Colophony's pricing model:** When/if Colophony is offered as a hosted service, what pricing model fits? Flat subscription, per-submission usage, commission on fees, tiered by features, tiered by volume, or dual model?

27. **Feature gating vs. volume gating:** Moksha puts all features on all plans and only gates by publication count. Submittable gates features by tier. Which approach fits Colophony's philosophy?

28. **Submission fee flexibility:** Currently Colophony has a hardcoded $25 fee. Should fees be org-configurable, per-period configurable, support waivers/discounts/coupon codes, or support multi-currency?

29. **Contributor payments:** Several competitors (Submittable Enterprise, Fluxx) handle paying contributors/awardees. Is paying accepted contributors in-platform a priority?

30. **PayPal support:** Currently Stripe-only. Is PayPal important for the target market?

### 8.6 Team & Organization

**Context:** Submittable has 5 permission tiers plus custom roles. Moksha has per-user permission flags. Colophony has 3 roles.

31. **Permission granularity:** Are 3 roles (Admin/Editor/Reader) sufficient, or do you need more granular permissions (e.g., "can bulk reject but not accept," "can see scores but not author names")?

32. **Org member invitations:** Currently stubbed. What's the invitation flow? Email invite, invite link, or both?

33. **Multi-publication per org:** Should an organization be able to run multiple publications/journals (like Moksha's multi-publication support)?

34. **Self-serve org creation:** Currently no self-serve org creation. Should users be able to create their own orgs, or is this always admin-provisioned?

### 8.7 Analytics & Reporting

**Context:** Most competitors have dashboards. Fluxx has 7,000+ dynamic visualizations. Scholastica tracks time-to-decision and editor-level metrics. Colophony currently has audit log export only.

35. **Dashboard priorities:** What metrics matter most? Submission volume over time, status pipeline, acceptance rate, time-to-decision, reviewer workload, reading period performance?

36. **Editor-level analytics:** Should the system track per-reviewer metrics (response time, decisions, workload) like Scholastica?

37. **Submitter analytics:** Should organizations see submitter demographics, repeat submission rates, geographic distribution?

38. **Export formats:** CSV export of audit logs exists. What other exports are needed? Submission data, analytics, financial reports?

### 8.8 Integrations & API

**Context:** Submittable has Zapier, REST API, and 7+ native integrations. Moksha has zero integrations (closed system). Colophony currently has internal tRPC only.

39. **Public API:** Should Colophony expose a public REST/GraphQL API for organizations to build on?

40. **Zapier/automation:** Is Zapier integration important for the target market, or are literary magazines too small to use it?

41. **Embeddable widgets:** Should submission forms be embeddable on the magazine's own website (ArtCall/EntryThingy pattern)?

42. **SSO:** Is SAML/OAuth SSO relevant for the target market, or only for larger institutions?

43. **Email marketing integration:** Should Colophony sync with Mailchimp/similar for building subscriber lists from submitters?

### 8.9 Branding & Customization

**Context:** Submittable offers custom CSS and white-labeling on Enterprise. Dapple has branded Pages. Moksha uses subdomains only.

44. **Custom domains:** Should organizations get `submissions.theirmagazine.com` instead of `colophony.app/their-magazine`?

45. **Visual customization:** How much branding control? Logo + colors only, custom CSS, or full theme control?

46. **White-labeling:** Should organizations be able to remove Colophony branding entirely?

### 8.10 Compliance & Security

**Context:** Colophony already leads in GDPR, audit logging, RLS, and virus scanning. Submittable has SOC 2 Type 2.

47. **SOC 2:** Is SOC 2 certification a priority? It's expensive but important for enterprise/institutional customers.

48. **Data retention UI:** Retention policies are implemented. Should there be a pre-configured set of recommended defaults, or is the current admin UI sufficient?

49. **Encryption at rest:** Currently not implemented for file storage. Is this a priority for the target market?

### 8.11 Post-Acceptance Workflow (Blue Sky)

**Context:** This is the biggest gap across ALL competitors. Most platforms end at the accept/reject decision. OESS and ShowSubmit auto-generate galleries from accepted work. Editorial Manager supports manuscript transfer between journals.

50. **Publication pipeline:** After accepting a submission, what happens? Should Colophony support copyediting workflow, proofreading stages, or is that out of scope?

51. **Contributor contracts:** Should the platform generate and track contributor agreements/contracts?

52. **Issue/edition assembly:** Should editors be able to assemble accepted pieces into issues/editions within the platform?

53. **Auto-generated publication page:** OESS and ShowSubmit auto-generate online galleries from accepted work. Should Colophony auto-generate a published issue page?

54. **Cross-journal transfer:** Editorial Manager lets rejected pieces transfer to another journal (with author consent). Is this relevant if multiple magazines use Colophony?

### 8.12 Existing Feature Enhancements

**Context:** Based on the codebase review, these are areas where current implementations could be improved.

55. **Password reset:** Schema is ready but no endpoint. Priority?

56. **OAuth/social login:** UserIdentity table is prepared. Should Google/GitHub login be added? For submitters, editors, or both?

57. **Full-text search:** search_vector is indexed but not queried. Should submissions be full-text searchable?

58. **Email verification enforcement:** Implemented but not enforced in all submission paths. Should unverified users be blocked from submitting?

59. **Payment receipts:** No receipt generation currently. Should submitters get receipt emails for submission fees?

60. **Refund workflow:** Currently webhook-only. Should there be a UI for editors/admins to initiate refunds?

### 8.13 Strategic Direction

61. **Target market:** Where does Colophony fit? Literary magazines only? All creative arts? Broader (contests, grants)?

62. **Self-hosted vs. hosted:** Is the long-term play purely self-hosted (like OJS), hosted SaaS, or both? The roadmap mentions "SaaS platform" under medium-term.

63. **Open source:** Should Colophony be open-source? OJS proves this model works at scale for publishing. It could capture the entire "Submittable is too expensive" market.

64. **Competitive positioning:** Against Submittable (feature-rich but expensive and drifting away from literary focus), Moksha (specialist but closed/limited), Dapple (modern but new/unproven), and Duosuma (cheap but tied to Duotrope ecosystem) -- where should Colophony sit?

65. **Two-sided marketplace:** Should Colophony invest in the submitter side (discovery, tracking, profiles) to create network effects, or stay purely publisher-focused?

---

## 9. Interview Results & Decisions

> **Interview date:** 2026-02-10
> **Interviewee:** David Mahaffey (primary dev, product owner)

### 9.1 Strategic Vision

| Decision                    | Detail                                                                                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Target market**           | Literary magazines in a modern web context — includes multimedia content like audio/video recordings of writers reading their work. Literary magazines have long since ceased to be purely text-based products.                               |
| **Deployment model**        | Both self-hosted and managed hosting. Even the self-hosted core needs a federated account system to accommodate migrations from self-hosted to managed.                                                                                       |
| **Open source**             | Fully open source. Monetize via managed hosting service, support, and the hosting itself — not feature gating.                                                                                                                                |
| **Positioning**             | "Infrastructure for lit mags" — not just submissions, but the platform literary magazines run on. Submissions, publication, community.                                                                                                        |
| **Two-sided marketplace**   | Both sides eventually. Publisher-first with basic submitter features now. Potential Chill Subs integration — David is friends with that team and they have long-term plans for a submissions platform. Build for extensibility.               |
| **Chill Subs integration**  | Too early to define specifics. Build for extensibility now. Define the integration shape when Chill Subs is ready.                                                                                                                            |
| **Pricing model (managed)** | Flat subscription rate with generous volume cap. Add-on pricing for additional volume at cost-only — profit comes from the managed service, not from penalizing successful magazines. NO feature gating. Targets tiny to mid-sized magazines. |

### 9.2 Editorial Workflow

| Decision                  | Detail                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Scoring/rating**        | Configurable per-org. Let each magazine choose their scoring system (numeric, Y/N/M, rubric, letter grade, etc.).                                                  |
| **Reviewer assignment**   | All models available, configurable per org: claim-from-queue (Moksha-style), round-robin auto-assignment, panel-based (Dapple-style).                              |
| **Review pipeline**       | Configurable stages. Orgs define their own pipeline (e.g., Slush -> First Read -> Editor Review -> Final Decision) with per-stage rules and automations.           |
| **Blind review**          | Yes, per-project toggle. Hides author name, email, and bio from reviewers.                                                                                         |
| **Bulk actions**          | All operations: bulk reject, status change, reassign, message, archive, and tag.                                                                                   |
| **View system**           | List view primary, kanban as alternative, configurable default per org. Explore additional view types (SmartSuite-style). Support private, per-editor saved views. |
| **AI content management** | Full Moksha-style: author affirmation checkbox + option to block AI submissions outright + auto-tagging for filtering.                                             |
| **Submission timeout**    | Yes, configurable. Admin sets timeout period; idle-claimed submissions auto-return to unclaimed queue with notification.                                           |
| **Keyboard shortcuts**    | Not explicitly discussed but implied by power-user view system.                                                                                                    |

### 9.3 Communication & Email

| Decision              | Detail                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Email templates**   | Full template system: accept, reject, hold, revision request, reading period open/close. All with merge fields (submitter name, title, etc.). Per-org customizable.                                           |
| **Messaging**         | Both internal (private editorial comments) + submitter-facing threaded messaging. Bidirectional email sync: messages via web UI send as emails; email replies appear in the web UI thread (SmartSuite-style). |
| **Scheduled sending** | Yes. Queue emails to send at a future date/time for batching decisions.                                                                                                                                       |
| **Draft reminders**   | Yes. Message submitters about incomplete draft submissions.                                                                                                                                                   |
| **Email provider**    | Provider-agnostic. Pluggable adapter pattern. Ship with SMTP + recommended provider. Community can add others. Fits open-source philosophy.                                                                   |

### 9.4 Submission Intake & Forms

| Decision                       | Detail                                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Form builder**               | Full drag-and-drop builder with multiple field types and conditional logic. Like Submittable's but open-source.                                                              |
| **Submission types**           | Essential. Different categories with different forms, rules, file types, and word counts per type.                                                                           |
| **Reading period enforcement** | Full: auto-open/close by date, submission count limits, per-author throttling. All configurable per period.                                                                  |
| **File types**                 | Expand to support audio + video uploads plus rich media embeds (YouTube, Vimeo, SoundCloud URLs). Support multimedia literary content.                                       |
| **Embeddable forms**           | Essential, but with careful attention to authentication UX. Users signed into a magazine's website need a clear path to Colophony auth for orgs without federated/SSO setup. |

### 9.5 Submitter Experience

| Decision                                | Detail                                                                                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth model**                          | Account strongly preferred. Federated auth for reducing friction. Admins can set account as optional for specific calls (some merit full anonymity, though seldom the norm).                       |
| **Simultaneous submission enforcement** | If a publication says no simultaneous submissions, the system should prevent sim-subbing across federated orgs/publications/calls. Novel use of federation.                                        |
| **Cross-publication transfer**          | Optional for editors to avoid adding to workloads. Primarily author-facing: rejected pieces can be re-submitted to another Colophony publication with author consent and one-click (no re-upload). |

### 9.6 Payments

| Decision                 | Detail                                                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Submission fees**      | Full flexibility + scholarship waivers + subscriber/member fee waivers (waive fees for paying magazine subscribers/members). Per-period configurable, optional/required/tiered, discount codes, multi-currency. |
| **Contributor payments** | In-platform as default via Stripe payouts, but trackable when paid outside Colophony. Many magazines have international contributors where specific payment providers can be a hassle if mandatory.             |
| **Payment providers**    | Provider-agnostic adapter pattern. Ship with Stripe + PayPal. Community can add others.                                                                                                                         |

### 9.7 Team & Organization

| Decision                    | Detail                                                                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Permission system**       | Configurable permissions per role with preset configs. Expand presets to 5 roles: Admin, Managing Editor, Editor, First Reader, Reader. Plus Submitter as a distinct role (someone could be a submitter at one publication and an editor at another). |
| **Organization hierarchy**  | One org > multiple publications per org > multiple call types per publication > multiple calls per call type. 4-level hierarchy.                                                                                                                      |
| **Self-serve org creation** | Not explicitly decided — implied by managed hosting model.                                                                                                                                                                                            |

### 9.8 Analytics & Reporting

| Decision      | Detail                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard** | Comprehensive: submission volume trends, pipeline by status, acceptance rate, time-to-decision, reviewer workload, reading period performance, submitter demographics. |

### 9.9 Integrations & API

| Decision       | Detail                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------- |
| **Public API** | Both REST + GraphQL (like GitHub's approach).                                                |
| **Automation** | Integrate with Zapier, Make, and n8n. Educate small lit mags about automation opportunities. |
| **Webhooks**   | Implied by automation integrations and API.                                                  |

### 9.10 Branding & Customization

| Decision           | Detail                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| **White-labeling** | Full white-label. The platform is invisible behind the magazine's brand.                                |
| **Domains**        | Both options: subdomains by default, custom domains as upgrade. Self-hosted users use their own domain. |

### 9.11 Post-Acceptance Pipeline

This is where Colophony diverges most dramatically from ALL competitors.

| Decision                  | Detail                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Publication pipeline**  | Full workflow management through production: copyediting, proofreading, layout, approval, scheduled. Integrates with WordPress/Ghost for publishing. Very basic built-in publishing option ("starter home") for magazines without other infrastructure. |
| **Contributor contracts** | Template generation with merge fields + built-in e-signature. Track contract status per piece.                                                                                                                                                          |
| **Issue assembly**        | Full issue management: create issues, add accepted pieces, order them, group into sections, generate TOC, set publication date. The editorial calendar.                                                                                                 |
| **CMS integration**       | Workflow + CMS integration (WordPress/Ghost). Colophony is the back-office, CMS is the front-end. Basic built-in option for magazines without a CMS.                                                                                                    |

### 9.12 Compliance & Security

| Decision               | Detail                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Existing gaps**      | Password reset, OAuth, full-text search, and email verification enforcement are ALL urgent. Should ship before new feature development.                                                        |
| **Auth service**       | Research first. Evaluate open-source auth services (Keycloak, Zitadel, Ory, Logto, etc.) that can handle OAuth, federation, SSO, and password reset. Federation requirement is the key driver. |
| **SOC 2**              | Not a priority. Target market is small magazines, not enterprises. GDPR compliance is more important.                                                                                          |
| **Encryption at rest** | Not explicitly decided.                                                                                                                                                                        |

### 9.13 New Feature Areas (Beyond Competitive Analysis)

These emerged during the interview as additional priorities:

| Feature Area                     | Decision                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Newsletters**                  | Integration hub + optional installation and configuration of a recommended open-source tool (e.g., Listmonk) for magazines that don't have their own setup.                      |
| **Social media**                 | Social post management for magazines. Part of the post-acceptance marketing calendar.                                                                                            |
| **Contributor CRM**              | Integration with external CRMs + either install/configure an open-source CRM or build a lightweight one. Same pattern as newsletters: integration hub with curated defaults.     |
| **Submitter CRM**                | Same approach. Track submitter relationships, submission history, and communication across the platform.                                                                         |
| **Marketing calendar**           | Basic marketing calendar as part of the post-acceptance workflow. Coordinate publication, newsletters, social posts.                                                             |
| **Magazine subscriptions/sales** | Research first. Evaluate open-source subscription tools that could self-host alongside Colophony. Ghost memberships, Memberful, Steady, and Stripe subscriptions are candidates. |
| **Accessibility**                | Important for inclusivity. WCAG compliance.                                                                                                                                      |
| **Internationalization**         | English at launch with a clear community contribution framework. Prioritize Spanish, French, and Portuguese based on literary publishing demand.                                 |
| **Mobile experience**            | Dedicated mobile interface for editors and submitters.                                                                                                                           |

### 9.14 Architectural Philosophy

A clear pattern emerged across all decisions:

> **Colophony as integration hub with curated open-source defaults.**

For every ancillary capability (newsletters, CRM, subscriptions, auth, payment processing), the approach is:

1. **Build adapter/integration interfaces** so magazines with existing tools can plug them in
2. **Curate and recommend open-source defaults** that can be installed and configured alongside Colophony for magazines without existing infrastructure
3. **Build a lightweight built-in option** only when no suitable open-source tool exists (e.g., the "starter home" publishing layer)

This philosophy serves both ends of the market:

- **Established magazines** bring their own tools and integrate via APIs
- **New/small magazines** get a complete, pre-configured stack out of the box

Combined with the open-source, self-hostable, federated model, this positions Colophony as a fundamentally different product than Submittable (closed SaaS), Moksha (closed single-developer tool), or Dapple (closed SaaS).

### 9.15 Key Differentiators (Post-Interview)

Based on all decisions, Colophony's competitive differentiation is:

1. **Open-source and self-hostable** — the only open-source submissions platform for literary magazines
2. **Federated identity** — cross-instance submitter identity, simultaneous submission enforcement, cross-journal transfers
3. **Full publication lifecycle** — submission through publication (no competitor does this)
4. **Integration hub architecture** — connect best-of-breed tools, with curated open-source defaults
5. **GDPR-first compliance** — already the strongest in the market
6. **"Infrastructure for lit mags"** — not just submissions, but the platform magazines run on
7. **No feature gating** — all features available on all plans
8. **Potential Chill Subs partnership** — two-sided marketplace via federation rather than lock-in
9. **Maximum editorial flexibility** — configurable scoring, assignment, stages, views, and workflows per org

### 9.16 Architectural Consequence: Full Reconceive

The scope of the vision that emerged from this interview is fundamentally different from the MVP prototype. After evaluating whether to evolve the existing codebase or reconceive from the ground up, the decision was made to **reconceive the architecture** while preserving domain knowledge, business rules, security patterns, and GDPR compliance logic from the MVP.

**Key architectural decisions:**

- Decomposed service architecture (not monolith)
- Plugin SDK + adapter pattern for extensibility
- Both REST + GraphQL public APIs
- Federated identity as a core architectural primitive
- Self-hosted (Docker Compose) + managed hosting (orchestrator TBD)
- Framework, ORM, auth service, and orchestration: all under active research

**What carries forward from the MVP:**

- PostgreSQL + RLS multi-tenancy patterns
- GDPR compliance logic (export, erasure, consent, retention, audit)
- Security patterns (rate limiting, headers, virus scanning, secret prevention)
- Business rules encoded as test specifications
- All competitive research and product decisions from this document

**Full architecture planning:** See `docs/architecture.md`

---

## Appendix: Source Index

### Primary Competitors

- [Submittable](https://submittable.com) -- Features, pricing, help center, API docs, reviews (Capterra, GetApp)
- [Moksha](https://moksha.io) -- Features, blog posts, FAQ, pricing, testimonials
- [Dapple](https://dapplehq.com) -- Features, pricing, Product Hunt, LitMagLab interviews
- [Duosuma](https://duotrope.com/duosuma/) -- Publisher features, pricing updates

### Submitter-Side Tools

- [Duotrope](https://duotrope.com) -- Features, statistics, editor interviews, Smart Search guide
- [The Submission Grinder](https://thegrinder.diabolicalplots.com) -- Advanced search, Piece Priority, Diabolical Plots blog
- [Chill Subs](https://chillsubs.com) -- Features, Electric Literature profile

### Adjacent Tools

- [Subfolio](https://subfol.io) -- Features, pricing, LitMagLab review
- [CLMP Submission Manager](https://clmp.org) -- CMS Critic overview
- [OpenWater](https://getopenwater.com), [Award Force](https://awardforce.com), [Judgify](https://judgify.me)
- [Fluxx](https://fluxx.io), [OpenGrants](https://opengrants.io), [SmarterSelect](https://smarterselect.com)
- [ScholarOne](https://silverchair.com), [Editorial Manager](https://ariessys.com), [OJS](https://pkp.sfu.ca/software/ojs/), [Scholastica](https://scholasticahq.com), [Manuscript Manager](https://manuscriptmanager.com)
- [FilmFreeway](https://filmfreeway.com), [Zealous](https://zealous.co), [Coverfly](https://coverfly.com) (discontinued)
- [ArtCall](https://artcall.org), [OESS](https://oess.org.uk), [ShowSubmit](https://showsubmit.com), [EntryThingy](https://entrythingy.com)

### Industry Coverage

- [LitMagLab: Submission Management Systems](https://litmaglab.substack.com/p/submission-management-systems-for-lit-mags-and-presses)
- [LitMagNews: Can We Talk About Submittable?](https://litmagnews.substack.com/p/can-we-talk-about-submittable)
- [CMS Critic: 3 Systems for Literary Journals](https://cmscritic.com/3-submission-management-systems-for-literary-journals-an-overview)
