# CampusHelper Master Plan 2026–2031

**Status:** Operating plan. This is the document we follow.
**Date:** 21 October 2026
**Founder:** Subhajit
**Current product:** CampusHelper — live campus lost-and-found platform with authentication, image uploads, search, claims, comments, moderation, explainable matching, saved searches, notifications, handover verification, campus zones, reputation, audit log, bulk moderation, and impact analytics.
**Current evidence:** live at `campushelper.vercel.app`; 24 tests; RLS, rate limits, CSRF, Zod validation; Prisma/PostgreSQL; Google OAuth; Vercel Blob.

---

## 0. Executive summary

### The decision

Do not sell a generic lost-and-found app.

Sell a **verified campus item-recovery workflow**: the system a university uses to intake, match, claim, hand over, and audit lost property across security desks, hostels, libraries, and student affairs.

Start with one paid campus pilot. Turn it into an annual per-campus subscription. Then expand from lost-and-found into **campus operations**: facilities issues, asset registry, student notifications, and multi-campus reporting.

### The ladder

1. **Campus Recovery Pilot** — ₹50k–₹1.5L for one campus, 8–12 weeks. Cash and case study.
2. **Campus Recovery** — ₹1.5L–₹5L per campus per year. Recurring revenue.
3. **Campus Exchange (optional)** — student-only, campus-scoped classifieds for books, cycles, electronics, hostel items, and free/donate. No payments at launch.
4. **Campus Operations** — ₹5L–₹15L per campus per year. Lost-and-found plus facilities, assets, and analytics.
5. **White-label / partner** — revenue share with campus portals, security vendors, or ERP integrators.

### The first 90 days

- Interview 15 campus buyers: student affairs, security, facilities, housing, CIO.
- Demo 3 campuses.
- Sign 2 pilot LOIs.
- Convert 1 paid pilot.
- Instrument the pilot: reports, recovery rate, median time-to-return, staff users, student satisfaction.
- Publish one case study with the before/after numbers.
- Decide go/no-go for the SaaS phase.

### The 3-year target

- 25–50 paying campuses.
- ₹1–3 crore ARR (~$120k–$360k).
- 70%+ gross margin.
- One repeatable onboarding playbook.
- One integration partnership.

### The 5-year target

- 100–200 campuses, or a white-label/partnership acquisition.
- ₹5–10 crore ARR (~$600k–$1.2M).
- A campus operations suite, not a single lost-and-found feature.
- Optional acquisition by a campus ERP, security, or student-services platform.

### The honest truth

Lost-and-found alone is a **feature**, not a venture-scale category.

The bottom-up market is real but modest: roughly 5,000 target campuses in India at ₹2L/year is about ₹100 crore (~$12M) of serviceable annual spend. A global slice at $5k/campus is larger but still not a venture-scale market on its own.

The business becomes interesting in one of three ways:

1. **Campus operations expansion** — facilities, assets, student services, multi-campus reporting.
2. **White-label distribution** — sell the recovery module to campus portals, security vendors, or ERP integrators.
3. **A strong portfolio product** — if campuses will not pay, keep CampusHelper as the best full-stack proof in your portfolio and do not pretend it is a startup.

A student-only Campus Exchange can increase weekly engagement, but it is optional, it is not the wedge, and it does not change the core economics. Do not build it before the recovery workflow has paying campuses.

That is the decision this plan is built around.

---

## 1. Strategic thesis

### 1.1 The problem

Every campus has a lost-and-found process. Most are informal:

- WhatsApp groups and student chats.
- Paper logs at security desks.
- Google Forms or spreadsheets.
- A cabinet in the student affairs office.
- A campus portal that does not handle claims or handover.

The result:

- Low recovery rates.
- Students do not know where to look.
- Staff spend hours matching items manually.
- There is no chain of custody.
- “Approved” is mistaken for “returned.”
- There is no data on what is lost, where, or why.
- Sensitive items and student identity are handled casually.

This is not a photo-sharing problem. It is an **item custody and recovery workflow** problem.

### 1.2 The product

CampusHelper turns a lost item into a tracked recovery case:

- intake at a security desk or by a student;
- structured item record with photos, category, zone, and tags;
- explainable LOST/FOUND matching;
- claim and counter-claim flow;
- six-digit handover verification;
- notification trail;
- append-only audit log;
- recovery analytics;
- campus-scoped access control.

The product is not “a board of lost items.” It is the record that proves an item was found, claimed, handed over, and closed.

### 1.3 The business

Sell to the campus, not the student:

- **Buyer:** Dean of Student Affairs, campus security chief, facilities/estates lead, housing, CIO.
- **Champion:** student council, security supervisor, student welfare officer.
- **Budget:** student services, campus security, facilities, digital transformation.
- **Contract:** annual per-campus subscription plus onboarding.
- **Expansion:** more zones, more staff seats, more modules, multi-campus groups.

### 1.4 Why now

- Campuses are digitizing student services and security operations.
- Students expect mobile-first, searchable workflows.
- Privacy and custody expectations are rising.
- Campus security budgets already exist; this is not a new budget line.
- The technical cost of building a multi-tenant workflow product is low.
- AI-assisted matching is useful, but the durable value is the workflow and the record, not the model.

### 1.5 What is durable vs commoditized

| Durable | Commoditized |
|---|---|
| Verified handover and chain of custody | Generic item CRUD |
| Campus zones, staff roles, and escalation | Image upload |
| Explainable matching and duplicate guard | A chat box |
| Audit log and recovery analytics | A public lost-and-found board |
| Student identity and campus SSO | A mobile shell |
| Multi-campus reporting | A single-campus demo |
| Integration with security and student services | A standalone app with no workflow |
| Trust, privacy, and retention controls | Model choice |

**Moat = campus workflow + verified handover + recovery data + integrations + switching costs.**

---

## 2. Market evidence

### 2.1 Demand signals

This plan uses a bottom-up model, not a purchased market report.

| Signal | Evidence | What it means |
|---|---|---|
| Every campus has the process | Security desks, student affairs, hostels, libraries, sports facilities | The workflow exists and is already staffed |
| The process is informal | WhatsApp, paper logs, spreadsheets, portals that do not handle claims | A structured product can replace manual work |
| Students are mobile-first | Campus apps, Google/Microsoft SSO, QR codes | A PWA is enough for v1 |
| Staff time is measurable | Intake, sorting, matching, handover, follow-up | The buyer can calculate hours saved |
| Recovery is the metric | “Did the student get the item back?” | The product must prove returns, not posts |
| Privacy matters | Student names, emails, photos, IDs, valuables | Campus-scoped access and retention are requirements |
| Existing tools are adjacent | Campus portals, ERP, security/incident tools, generic lost-and-found apps | None owns the full recovery workflow |

### 2.2 Bottom-up market

Assumptions, clearly labelled:

- India has roughly **1,100 universities and 45,000 colleges** (AISHE 2021–22 scale).
- Target segment: **5,000 campuses** with at least 5,000 students and a digital student-services budget.
- Average annual contract: **₹2L** (range ₹1.5L–₹5L).
- Serviceable annual spend: **₹100 crore** (~$12M).
- Global: 25,000+ higher-education institutions; at $5k average, a much larger but harder-to-reach market.

This is enough for a bootstrapped, profitable company. It is not enough, by itself, for a venture-scale outcome. That is why the plan expands into campus operations and white-label distribution.

### 2.3 Buyer pains

The buyer does not wake up wanting “a lost-and-found app.” The buyer says:

- “My security desk spends hours on this.”
- “Students complain that nothing is centralized.”
- “We cannot prove who handed what to whom.”
- “We have no idea what is lost most often or where.”
- “Our portal does not handle claims or photos.”
- “We need a record for audits and disputes.”
- “We cannot expose student names and photos publicly.”

### 2.4 Competitive map

| Alternative | What it does | Why it loses |
|---|---|---|
| WhatsApp groups | Fast, familiar | No record, no search, no custody, no analytics |
| Paper log / spreadsheet | Cheap | No matching, no notifications, no audit |
| Campus portal / ERP | Official system of record | Slow to customize; lost-and-found is a minor module |
| Generic lost-and-found app | Public posting | Not campus-scoped; no staff workflow; no handover proof |
| Security/incident platform | Broad operations | Overkill; expensive; lost-and-found is an afterthought |
| Asset management suite | Tracks owned assets | Not built for student-found items or claims |

**Our position:** the campus-specific recovery workflow with verified handover, explainable matching, staff roles, and recovery analytics.

---

## 3. Product portfolio

### 3.1 Product ladder

| Product | Buyer | Price | Phase | Purpose |
|---|---|---|---|---|
| Campus Recovery Pilot | One campus | ₹50k–₹1.5L / 8–12 weeks | 0–1 | Validation, case study, cash |
| Campus Recovery | One campus | ₹1.5L–₹5L/year | 1–2 | Recurring revenue |
| Campus Exchange (optional) | Students, campus opt-in | Included in Campus Recovery Plus; featured listings later | 2.5 | Engagement, weekly habit |
| Campus Operations | Multi-department campus | ₹5L–₹15L/year | 3 | Facilities, assets, analytics |
| Multi-campus | University group | ₹10L–₹30L/year | 3–4 | Group reporting and controls |
| White-label | Portal/security/ERP partner | Revenue share | 4 | Distribution |

### 3.2 Core objects

**Campus / Tenant**
- id, name, domain, branding, plan, status
- zones, staff roles, retention policy
- SSO configuration, billing owner

**User / Student**
- id, name, email, campus, role
- student verification state
- notification preferences
- reputation ledger
- deactivation and audit state

**Item**
- id, campus, type (LOST/FOUND), status
- title, description, category, tags
- photos, storage location, zone
- reporter, timestamps, resolution
- sensitivity flag (phone, wallet, ID, keys)

**Match**
- item pair, score, reasons
- confirmed / dismissed / expired
- actor and timestamp

**Claim**
- claimant, item, status
- evidence or description
- moderator decision
- one active claim per item

**Handover**
- six-digit code, expiry, attempts
- issuer, verifier, timestamp
- item resolution event

**Notification**
- type, recipient, channel, payload
- read state, digest state

**AuditEvent**
- actor, actor email snapshot, action
- target, reason, metadata, IP
- timestamp, tenant

**SavedSearch**
- owner, filter set, alert state
- created-at index

**Asset** (Phase 3)
- tag, item, owner department
- custody history

### 3.3 What we will not build

- A generic public marketplace, shipping product, or payments/escrow product. A student-only, campus-scoped Campus Exchange is a later opt-in module, not the wedge.
- Paid marketplace transactions at launch.
- A social network for students.
- A generic chat app.
- A full campus ERP.
- A native mobile app before the PWA proves retention.
- An AI chatbot that guesses where an item is.
- An insurance or valuation product without a licensed partner.
- A “smart campus” platform with no wedge.

### 3.4 What already exists and how it changes

| Existing asset | New role | Action |
|---|---|---|
| Item reporting, search, images | Core recovery workflow | Keep; add bulk intake and QR |
| Explainable match engine | Recovery accelerator | Keep; add confidence thresholds and staff review |
| Duplicate guard | Data quality | Keep; make it tenant-aware |
| Saved searches | Student retention | Keep; add email/SMS digests |
| Notification centre | Workflow | Add email/SMS/push transports |
| Handover verification | Chain of custody | Keep; add QR and audit export |
| Zones and map | Campus context | Keep; add building/floor hierarchy |
| Reputation and badges | Student engagement | Keep; make campus-configurable |
| Audit and bulk moderation | Trust and operations | Keep; add export and retention |
| Analytics and CSV | Buyer value | Keep; add recovery-rate benchmarks |
| RLS and rate limits | Security | Make tenant-aware and runtime-enforced |
| 24 tests | Quality base | Add DB integration and E2E coverage |

### 3.5 Gaps to close before the first paid pilot

These are the real blockers, from the current roadmap and code review:

1. **Multi-tenancy.** Add `tenantId` to every campus-owned table, composite indexes, and tenant-scoped queries. The current app is single-campus.
2. **RLS enforcement.** The runtime role and policies must be applied and verified; the table owner must not be the app connection.
3. **Student verification.** Replace “moderator says verified” with campus email-domain verification or SSO; keep moderator override.
4. **Notification transports.** In-app only is not enough for a campus. Add email first, then SMS/push.
5. **Data lifecycle.** Account deletion, item retention, photo retention, export, and audit retention.
6. **Known correctness gaps.** Fix the two “deleted” representations, CSV truncation signal, comment notifications/reputation, moderation reputation, handover-attempt race, and saved-search index.
7. **Database-backed CI.** Non-admin API routes need integration tests against Postgres.
8. **Observability.** Error tracking, request IDs, backup/restore drill, uptime checks.
9. **Onboarding.** A campus cannot self-serve yet: import zones, staff, categories, and existing items.
10. **PWA.** Mobile-first installable experience before native.

### 3.6 Campus Exchange (optional Phase 2.5)

Lost-and-found is episodic. A student marketplace is weekly. The same identity, photos, categories, moderation, notifications, zones, and handover code can support a trusted campus-only exchange.

**What it is**

- Student-only, campus-scoped listings for books, cycles, electronics, hostel items, furniture, and free/donate.
- Seller lists a price or “free”; buyer contacts the seller in-app; handoff happens in person on campus.
- No shipping. No platform payments at launch. Students pay each other directly via UPI/cash; the platform records the handoff.
- High-value items can use the same six-digit handover code.
- Categories, search, saved searches, notifications, report/block, and moderation.
- Each campus can opt in or out and restrict categories.

**What it is not**

- A generic public marketplace or OLX clone.
- A payments, escrow, or wallet product.
- A shipping or logistics product.
- A place for prohibited items, services, or academic work.

**Trust and safety**

- Verified student identity.
- Prohibited list: weapons, drugs, alcohol, tobacco, medicines, live animals, stolen goods, academic cheating, fake IDs, and financial instruments.
- Report/block, moderation queue, and audit.
- Meet in public campus locations; never publish home addresses.
- No public indexing; no guest browsing.
- Stolen-goods policy: remove, ban, and cooperate with campus security. A found item can never be listed for sale by the finder.
- Price/description moderation and image checks.
- No platform payment; disputes are between students, with staff escalation for prohibited items.

**Why wait**

- Marketplace adds scams, stolen goods, disputes, payments, tax, and university liability.
- The buyer is student affairs/security; they may not want a marketplace.
- It competes with WhatsApp and OLX; the only defensible angle is verified campus identity plus safe handoff.
- Build it after 10 paying campuses and only where the campus opts in.

**Pricing**

- Included in Campus Recovery Plus at launch; no transaction fee.
- Featured listings later, only if measured.
- Never take a cut of student-to-student payments until payments/escrow are legally reviewed.

**Gate**

- 50 listings in 2 weeks at one campus.
- 20%+ sold or rehomed.
- Reported listings below 5%.
- No critical safety incident.
- If the gate fails, remove the module.

---

## 4. Buyers and jobs to be done

### 4.1 Phase 1 ICP: private Indian university, 5k–50k students

- **Buyer:** Dean of Student Affairs, campus security chief, facilities head, CIO.
- **Champion:** student council president, security supervisor, student welfare officer.
- **Trigger:** new academic year, campus security audit, accreditation, student complaints, digital services initiative.
- **Budget:** student services, security, facilities, IT.
- **Job:** “Reduce lost-item chaos, staff time, and student complaints, and give us a record we can trust.”
- **Success:** higher recovery rate, lower time-to-return, fewer staff hours, fewer escalations.

### 4.2 Phase 2: housing, libraries, sports

- **Buyer:** housing office, library operations, sports complex.
- **Job:** “Handle items found in our building without sending students across campus.”
- **Expansion:** zone-specific intake, building-level analytics, staff seats.

### 4.3 Phase 3: multi-campus groups

- **Buyer:** university group CIO, operations head.
- **Job:** “Give us one view across campuses and a standard workflow.”
- **Expansion:** group dashboards, shared taxonomy, central audit, SSO.

### 4.4 Phase 4: white-label partners

- **Buyer:** campus portal vendor, security vendor, ERP integrator.
- **Job:** “Add a recovery module to our platform without building it.”
- **Expansion:** API, embeddable UI, revenue share.

---

## 5. Phase 0 — Validation (22 Oct–18 Nov 2026)

### Objective

Prove that a campus will pay for a structured recovery workflow before building multi-tenancy.

### Deliverables

- 15 buyer interviews.
- 3 campus demos.
- 2 pilot LOIs.
- 1 paid pilot.
- A one-page pilot offer and a pilot agreement.
- A baseline: current monthly lost-item volume, recovery rate, staff hours, and complaints.
- A go/no-go decision.

### Workstreams

| Workstream | Actions | Output |
|---|---|---|
| Positioning | Rewrite the one-page pitch around recovery and custody, not “lost-and-found app” | 1-page PDF |
| Buyer list | 50 target campuses: private universities, large colleges, security heads, student affairs | CRM list |
| Outreach | 20 warm intros, 50 cold emails, 15 calls booked | Pipeline |
| Demo | Use the live app with a campus story; show handover and analytics | Demo script |
| Pilot design | Scope, success metrics, data handling, staff training | Pilot SOW |
| Pricing | Test ₹50k, ₹1L, ₹1.5L for the pilot; ₹1.5L–₹3L annual | Price signal |
| Legal | Pilot agreement, DPA, privacy note, data retention | Templates |
| Proof | Document the current process at 3 campuses | Baseline notes |

### Weekly plan

**Week 1**
- Finalize ICP and one-page pitch.
- Build the 50-campus list.
- Send 30 outreaches.
- Draft the pilot SOW and success metrics.

**Week 2**
- Complete 10 interviews.
- Run 2 demos.
- Refine the pitch around the strongest pain.
- Ask 5 campuses for a paid pilot.

**Week 3**
- Complete 15 interviews.
- Sign 2 pilot LOIs.
- Convert 1 paid pilot.
- Baseline the pilot campus.

**Week 4**
- Start onboarding.
- Decide go/no-go for Phase 1.
- If no paid pilot, stop and keep CampusHelper as a portfolio product.

### Gate

- 15 interviews completed.
- 3 demos delivered.
- 2 pilot LOIs.
- 1 paid pilot at ₹50k+.
- At least one buyer says recovery rate or staff time is a budgeted problem.
- A baseline exists for the pilot campus.

**If the gate fails:** do not build multi-tenancy. Publish the product as a portfolio case study, or pursue a white-label conversation with a campus portal vendor.

### Budget

- ₹20k–₹50k: travel, design, legal template, pilot support.
- Founder time: full-time for 4 weeks.
- No hires.

---

## 6. Phase 1 — Pilot (19 Nov 2026–31 Jan 2027)

### Objective

Run one paid campus pilot, prove recovery improvement, and convert it into an annual contract.

### Product deliverables

- Tenant-scoped database and RLS.
- Campus onboarding: zones, categories, staff, existing items.
- Student email-domain verification or SSO.
- QR-code intake at security desks.
- Bulk item import from spreadsheets.
- Email notifications; SMS optional.
- Handover OTP/QR and audit export.
- Recovery dashboard: reports, recovery rate, median time-to-return, top zones.
- PWA install and mobile-first flow.
- Support runbook and status page.

### Pilot success metrics

| Metric | Target |
|---|---|
| Item reports | 100+ in 8 weeks |
| Verified returns | 30%+ of found items |
| Median time-to-return | 5 days or less |
| Staff users | 10+ |
| Student satisfaction | 80%+ |
| Duplicate reports | Below 10% |
| Critical security incidents | 0 |
| Uptime | 99.5%+ |

### Pricing

- Pilot: ₹50k–₹1.5L for 8–12 weeks.
- Includes onboarding, staff training, and a case study.
- Convert to annual: ₹1.5L–₹5L depending on student count and modules.
- Do not discount below ₹50k. If they will not pay, they are not the buyer.

### Gate

- Paid pilot completed.
- Recovery rate and time-to-return measured against baseline.
- 10+ staff users active weekly.
- One written testimonial or case study.
- One referral or second-campus conversation.
- At least one annual contract signed or verbally committed.

**If the gate fails:** keep the pilot as a case study; do not build the SaaS billing layer. Try a white-label partner before expanding.

---

## 7. Phase 2 — Campus Recovery SaaS (Feb–Aug 2027)

### Objective

Turn the pilot into a repeatable, multi-tenant product with 10–25 paying campuses.

### Product deliverables

- Self-serve tenant creation and onboarding checklist.
- Billing and plan enforcement.
- Google/Microsoft SSO and student email verification.
- Email/SMS/push notification transports.
- Staff roles: intake, moderator, security, student affairs, read-only.
- Bulk intake and label printing for high-value items.
- Recovery analytics and monthly campus report.
- Data export and deletion.
- API for campus portal integration.
- Status page, backups, and incident runbook.

### Pricing

| Plan | Price | Includes |
|---|---|---|
| Campus Recovery | ₹1.5L–₹3L/year | One campus, core workflow, 10 staff seats |
| Campus Recovery Plus | ₹3L–₹5L/year | SSO, SMS, analytics, integrations, 25 seats |
| Multi-campus | ₹10L–₹30L/year | Group dashboard, central audit, shared taxonomy |

### Gate

- 10 paying campuses.
- ₹30L–₹75L ARR.
- 70%+ gross margin.
- 90% logo retention.
- 30%+ recovery rate across active campuses.
- Onboarding time under 10 business days.
- Support under 5 tickets per campus per month.

**If the gate fails:** stay a boutique pilot/service business; do not hire a sales team. Narrow to one segment (private universities or housing).

---

## 7A. Phase 2.5 — Campus Exchange (optional, Q2–Q3 2027)

### Objective

Test whether a student-only exchange increases weekly engagement without adding unacceptable trust and safety risk.

### Scope

- One opted-in campus.
- Books, cycles, electronics, hostel items, furniture, and free/donate.
- Listing, search, saved searches, in-app contact, report/block, moderation.
- In-person handoff on campus; no shipping.
- No platform payments; students pay each other via UPI/cash.
- The six-digit handover code is available for high-value items.
- The campus can disable categories or the module entirely.

### Trust and safety

- Verified student identity only.
- Prohibited items: weapons, drugs, alcohol, tobacco, medicines, live animals, stolen goods, academic cheating, fake IDs, financial instruments.
- Stolen-goods policy: remove, ban, and cooperate with campus security. Found items cannot be sold by the finder.
- Meet in public campus locations; never publish home addresses.
- Report/block, moderation queue, audit log.
- No public indexing, no guest browsing.

### Metrics

- 50 listings in the first 2 weeks.
- 20%+ sold or rehomed.
- Reported listings below 5%.
- Weekly active students up 20% versus the recovery-only baseline.
- No critical safety incident.

### Gate

If the gate fails, remove the module and keep CampusHelper focused on recovery. If it passes, include Campus Exchange in Campus Recovery Plus and expand to three campuses.

**Do not build payments, escrow, shipping, or a transaction fee at this stage.**

---

## 8. Phase 3 — Campus Operations (Sep 2027–Dec 2028)

### Objective

Expand from lost-and-found into the campus operations workflow, with 50–150 campuses.

### Product additions

- Facilities/issues module: broken fixtures, maintenance requests, status tracking.
- Asset registry: tagged campus assets, custody, loans, returns.
- Student services: found-item pickup appointments, notifications, status.
- Multi-campus reporting and benchmarks.
- Integration marketplace: campus portals, SSO, Slack/Teams, email, SMS.
- Security desk console: fast intake, label printing, shift handover.
- Audit and compliance exports.

### Why this matters

Lost-and-found alone is a ₹100 crore serviceable market. Campus operations is a larger budget with the same buyer, same workflow, and same trust layer. The expansion is not random: it uses the same campus, zones, staff roles, notifications, audit, and analytics.

### Pricing

- Campus Operations: ₹5L–₹15L/year.
- Multi-campus group: ₹10L–₹30L/year.
- Integration/setup: ₹1L–₹5L.

### Gate

- 50+ campuses.
- ₹1–3 crore ARR.
- 20%+ of revenue from modules other than lost-and-found.
- 85%+ gross margin on software.
- One channel partner or integration.

---

## 9. Phase 4 — Platform / White-label (2029–2031)

### Objective

Become the recovery and custody layer inside campus platforms, or a profitable multi-campus operations company.

### Paths

1. **Direct:** 100–200 campuses, ₹5–10 crore ARR, profitable.
2. **White-label:** embed the recovery module in a campus portal, security, or ERP product; revenue share.
3. **Acquisition:** campus ERP, security, or student-services platform buys the workflow and customer base.
4. **Portfolio:** if the market does not pay, keep CampusHelper as the strongest full-stack case study and stop investing.

### Gate

- ₹5 crore ARR or a signed white-label/acquisition term sheet.
- 70%+ gross margin.
- 100+ campuses or 3+ partners.
- A repeatable onboarding and support model.

---

## 10. Technical architecture and build plan

### 10.1 Current architecture

```
Next.js App Router
  public pages, dashboard, admin, API routes
        |
NextAuth (Google OAuth)
        |
Prisma + PostgreSQL (Supabase)
        |
Supabase Storage / Vercel Blob
        |
Rate limits, CSRF, Zod, RLS
        |
Vercel deployment
```

### 10.2 Target architecture

```
Client
  PWA (mobile-first), staff console, admin console
        |
Edge / API
  Next.js route handlers, tenant resolution, auth, rate limits
        |
Domain services
  items, matching, claims, handover, notifications, analytics, audit
        |
Data
  PostgreSQL (tenant_id, RLS, indexes)
  object storage (photos, signed URLs)
  queue / cron (notifications, digests, cleanup)
        |
Integrations
  Google/Microsoft SSO, campus email, SMS, push,
  campus portal API, Slack/Teams, CSV
        |
Observability
  error tracking, request IDs, audit, backups, uptime
```

### 10.3 Multi-tenancy

- Every campus-owned row gets `tenantId`.
- Composite indexes lead with `tenantId`.
- RLS policies use the tenant context and runtime role.
- The app connects as a non-owner runtime role; migrations use a separate owner.
- Tenant resolution from the subdomain, path, or authenticated membership.
- No cross-tenant query without an explicit platform-admin role.
- Tenant-scoped object storage prefixes and signed URLs.

### 10.4 Identity

- Google and Microsoft SSO.
- Campus email-domain verification.
- Moderator override with audit.
- Staff invitations and role assignment.
- Student ID integration only when a campus asks for it.
- Session revocation on deactivation.

### 10.5 Intake and custody

- QR code at each security desk and zone.
- Bulk intake from CSV with validation preview.
- Photo capture and compression.
- Storage location and shelf/box label.
- Sensitivity flag for wallets, phones, IDs, keys.
- Chain-of-custody events: intake, move, claim, handover, disposal.

### 10.6 Matching and privacy

- Explainable weighted signals, already shipped.
- Tenant-scoped candidate window.
- High-value items gated behind staff review.
- No public exposure of student names, emails, or sensitive descriptions.
- Duplicate guard with an explicit override.
- Match confidence and reason shown to staff and the item owner.

### 10.7 Handover

- Six-digit code with expiry and attempt limits.
- QR handover for staff.
- “Approved” is not “returned.”
- Audit event with actor, time, location, and item.
- Exportable custody record for disputes.

### 10.8 Notifications

- In-app first.
- Email for claims, matches, handover, saved searches, moderation.
- SMS for high-value or time-sensitive events.
- Push for the PWA.
- Digest and quiet hours.
- All transports logged and retryable.

### 10.9 Analytics

- Recovery rate.
- Median time-to-return.
- Reports by zone, category, and day.
- Repeat lost items and repeat finders.
- Staff workload and intake-to-shelf time.
- Claims funnel.
- Monthly campus report.

### 10.10 Non-negotiables

- Tenant isolation.
- RLS enforced at runtime.
- Append-only audit for privileged actions.
- No public PII.
- Data retention and deletion.
- Image moderation for public surfaces.
- Accessibility: WCAG 2.2 AA.
- Backups and a restore drill.
- Rate limits and abuse controls.
- E2E tests before each paid pilot.
- No AI claim that cannot be explained.

---

## 11. Go-to-market playbook

### 11.1 Beachhead

Private Indian universities and large colleges with:

- 5,000+ students.
- A central security desk.
- A student affairs office.
- A digital services initiative.
- A visible lost-and-found pain.

### 11.2 Target list

- 50 campuses in the first list.
- Student affairs deans.
- Campus security chiefs.
- Facilities/estates heads.
- CIOs and digital transformation leads.
- Student council presidents as champions.

### 11.3 Outreach

- Warm intro through alumni, student councils, and campus security networks.
- LinkedIn: “We help campuses return lost items faster and prove every handover.”
- Email: a one-page pilot offer with a 3-minute demo.
- Campus visit: bring a QR-code intake kit and run a 30-minute workflow demo.
- Content: “What 1,000 campus lost-item reports look like,” “The 30-day campus recovery pilot,” “Why ‘approved’ is not ‘returned.’”

### 11.4 Demo script

1. A student reports a lost phone.
2. A security desk intakes a found phone.
3. The explainable match suggests the pair.
4. The owner claims it; a moderator approves.
5. A six-digit handover code verifies the return.
6. The dashboard shows recovery rate and median time.
7. The audit log shows every step.

### 11.5 Pilot offer

> “Run a 30-day campus recovery pilot. We onboard your zones and staff, put a QR code at the security desk, and measure recovery rate, time-to-return, and staff hours against your current process. If it does not beat the baseline, you do not continue.”

### 11.6 Discovery questions

1. How many lost-item reports do you handle per month?
2. Where are items stored, and who owns the process?
3. What is the current recovery rate?
4. How long does a return take?
5. How do you prove a handover?
6. What happens to unclaimed items?
7. What data can be public, and what must stay private?
8. What would make this a budgeted priority?
9. Who else needs to approve?
10. What would make you stop the pilot?

### 11.7 Pipeline math (Phase 0)

- 50 target campuses.
- 20 warm intros.
- 50 cold emails.
- 15 calls.
- 3 demos.
- 2 LOIs.
- 1 paid pilot.

---

## 12. Pricing and financial model

### 12.1 Pricing

| Product | Price | Notes |
|---|---|---|
| Pilot | ₹50k–₹1.5L | 8–12 weeks, onboarding included |
| Campus Recovery | ₹1.5L–₹3L/year | One campus, core workflow |
| Campus Recovery Plus | ₹3L–₹5L/year | SSO, SMS, analytics, integrations |
| Multi-campus | ₹10L–₹30L/year | Group dashboard and central audit |
| Campus Operations | ₹5L–₹15L/year | Lost-and-found plus facilities/assets |
| Setup/integration | ₹50k–₹5L | Data import, SSO, portal integration |
| White-label | Revenue share | Partner-led distribution |

These are starting assumptions. Price is validated in Phase 0.

### 12.2 Unit economics targets

- Gross margin: 70–80%.
- Hosting/infra: under 10% of revenue.
- Support: under 20% of revenue.
- Sales and onboarding: under 30% of revenue.
- CAC payback: under 12 months.
- Logo retention: 90%+.
- Net revenue retention: 110%+ with modules.

### 12.3 Revenue targets

| Phase | Period | ARR | Campuses |
|---|---|---:|---:|
| 0 | Oct–Nov 2026 | ₹0 | 1 pilot |
| 1 | Nov 2026–Jan 2027 | ₹1L–₹5L pilot cash | 1–3 pilots |
| 2 | Feb–Aug 2027 | ₹30L–₹75L | 10–25 |
| 3 | Sep 2027–Dec 2028 | ₹1–3 crore | 50–150 |
| 4 | 2029–2031 | ₹5–10 crore | 100–200 or partners |

These are targets, not promises. Gates decide whether to continue.

### 12.4 Funding

- Bootstrap through the first paid pilot.
- Do not raise before paid demand.
- If the campus operations expansion works, a small angel/seed round is optional.
- A venture round only makes sense if the white-label/operations path shows a much larger market.

---

## 13. Team and hiring

### Phase 0
- Founder: sales, product, onboarding.
- Contract: designer, legal/privacy advisor.

### Phase 1
- Founder.
- Contract engineer for multi-tenancy and notifications.
- Campus success/onboarding contractor.
- Advisor: campus security or student affairs.

### Phase 2
- Founder/CEO.
- Full-stack engineer.
- Customer success.
- Part-time sales.

### Phase 3
- 5–8 people.
- Engineering lead.
- Sales lead.
- Support/onboarding.
- Designer.

### Culture
- Recovery rate over vanity posts.
- Verified handover over “approved.”
- Campus workflow over generic features.
- Privacy over public exposure.
- Paid pilots over free pilots.
- Publish the baseline, including failures.

---

## 14. Legal, compliance, and trust

### 14.1 Positioning

CampusHelper is a campus workflow and record-keeping product. It is not:

- a law firm;
- a insurer;
- a valuation or appraisal service;
- a law-enforcement system;
- a guarantee that every item will be returned.

### 14.2 Data protection

- India: Digital Personal Data Protection Act, 2023 (DPDP).
- US: FERPA where applicable; do not expose education records.
- GDPR-style principles if serving international campuses.
- Data processing agreement with each campus.
- Retention policy per tenant.
- Account deletion and data export.
- Subprocessor list.
- Photo and PII minimization.
- Audit access and breach notification.

### 14.3 Student data

- Public surfaces show the minimum needed to identify an item.
- Names, emails, phone numbers, and IDs are private by default.
- High-value items are staff-mediated.
- Student verification is explicit and auditable.
- Moderators can remove sensitive photos.

### 14.4 Security

- RLS at runtime, not just in development.
- Separate migration and runtime roles.
- Secrets in the platform vault.
- Rate limits and CSRF.
- Dependency scanning.
- Backups and restore drills.
- Incident response runbook.
- Penetration test before the first multi-campus contract.

### 14.5 Pilot agreement outline

- Scope and campus.
- Success metrics.
- Data handling and retention.
- Staff responsibilities.
- Support and uptime.
- Fees and payment.
- Termination and data return.
- Liability and disclaimer.
- Case-study permission.

---

## 15. Metrics and gates

### 15.1 North star

**Verified returns per 1,000 students per month.**

This is better than “items posted” or “active users.” It measures the outcome the campus pays for.

### 15.2 Phase metrics

| Phase | Metric | Target |
|---|---|---|
| 0 | Buyer interviews | 15 |
| 0 | Demos | 3 |
| 0 | Pilot LOIs | 2 |
| 0 | Paid pilots | 1 |
| 1 | Reports in pilot | 100+ |
| 1 | Recovery rate | 30%+ |
| 1 | Median time-to-return | 5 days or less |
| 1 | Staff users | 10+ |
| 1 | Student satisfaction | 80%+ |
| 2 | Paying campuses | 10–25 |
| 2 | ARR | ₹30L–₹75L |
| 2 | Logo retention | 90% |
| 2.5 | Exchange listings (one campus, 2 weeks) | 50 |
| 2.5 | Exchange sold/rehomed | 20%+ |
| 2.5 | Exchange reported listings | below 5% |
| 3 | Campuses | 50–150 |
| 3 | ARR | ₹1–3 crore |
| 4 | ARR | ₹5–10 crore |

### 15.3 Kill criteria

- No paid pilot after 20 qualified conversations.
- Recovery rate does not beat the campus baseline.
- Staff will not use the workflow after training.
- Sales cycle exceeds 9 months for a ₹2L contract.
- Churn above 20% after the first year.
- Support burden above 10 tickets per campus per month.
- A privacy or security incident caused by the product.
- The buyer wants a free pilot forever.
- The only demand is from one champion with no budget.

### 15.4 Pivot options

- **Portfolio product:** keep the live app, publish the case study, stop selling.
- **White-label:** embed the module in a campus portal or security vendor.
- **Services:** run the lost-and-found workflow for a campus as a managed service.
- **Campus operations:** expand into facilities and assets.
- **Housing-only:** narrow to hostels and residential life.

---

## 16. 90-day weekly plan

| Week | Focus | Output |
|---|---|---|
| 1 | ICP, pitch, 50-campus list | One-page offer |
| 2 | 10 interviews, 2 demos | Pain map |
| 3 | 15 interviews, pilot SOW | 2 LOIs |
| 4 | Convert 1 paid pilot; baseline | Signed pilot |
| 5 | Multi-tenant schema + RLS | Tenant isolation |
| 6 | Onboarding: zones, staff, items | Pilot campus live |
| 7 | QR intake, email notifications | Staff workflow |
| 8 | Handover verification, dashboard | Recovery metrics |
| 9 | Pilot operations, training | Active usage |
| 10 | Fix top 5 pilot issues | Stability |
| 11 | Case study draft, referral ask | Proof |
| 12 | Pricing review, annual contract | Conversion |
| 13 | Go/no-go for SaaS phase | Decision |

---

## 17. Resume-grade evidence

The master plan is also a resume plan. Do not claim “SaaS” or “paying customers” until they exist.

### What you can claim now

- Built a live campus lost-and-found platform with authentication, image uploads, claims, moderation, and analytics.
- Designed an explainable weighted match engine with duplicate guard, saved searches, and campus-zone density map.
- Implemented six-digit handover verification with expiry and attempt limits, append-only audit, bulk moderation, and CSV analytics.
- Enforced server-side validation, rate limits, CSRF, RLS, and tenant-safe data access.
- 24 tests and a live deployment.

### What to measure in the pilot

- Number of campuses.
- Number of reports.
- Recovery rate vs baseline.
- Median time-to-return.
- Staff users and staff hours saved.
- Student satisfaction.
- Uptime and incident count.

### Resume bullet templates

- “Piloted a campus recovery workflow at **N** campuses; **X** reports, **Y%** recovery rate, **Z-day** median time-to-return, **S** staff users.”
- “Built a multi-tenant Next.js/PostgreSQL platform with explainable matching, verified handover, audit, and recovery analytics; **24 tests**, RLS, rate limits, and a live deployment.”
- “Designed a six-digit handover workflow that distinguishes approved claims from verified returns; expiry, attempt limits, and audit trail.”
- “Built an optional campus-only student exchange with verified identity, campus-scoped listings, moderation, and safe in-person handoff; no payments at launch.”
- After the exchange experiment: “**X** listings in two weeks, **Y%** sold/rehomed, **Z%** reported, no critical safety incidents.”

### What not to claim

- “SaaS” before recurring revenue.
- “Thousands of users” without evidence.
- “AI-powered” unless the matching is actually used and measured.
- “Enterprise-grade” or “production-ready.”
- A recovery improvement without a baseline.

---

## 18. Appendices

### A. Multi-tenant data model (v0.2)

```
Tenant(id, name, domain, plan, status, createdAt)
TenantMembership(tenantId, userId, role)
Zone(id, tenantId, name, building, floor, x, y)
Item(id, tenantId, type, status, title, description, categoryId,
     zoneId, storageLocation, reporterId, sensitivity, createdAt, resolvedAt)
ItemImage(id, tenantId, itemId, storageKey, alt, moderationState)
Match(id, tenantId, lostItemId, foundItemId, score, reasons, status)
Claim(id, tenantId, itemId, claimantId, status, decidedBy, decidedAt)
Handover(id, tenantId, claimId, codeHash, expiresAt, attempts, verifiedBy, verifiedAt)
Notification(id, tenantId, userId, type, channel, payload, readAt, sentAt)
AuditEvent(id, tenantId, actorId, actorEmail, action, targetType, targetId,
           reason, metadata, ip, createdAt)
SavedSearch(id, tenantId, userId, filters, createdAt)
ReputationLedger(id, tenantId, userId, kind, itemId, points, createdAt)
```

Rules:

- Every tenant-owned table has `tenantId`.
- Composite indexes lead with `tenantId`.
- RLS policy uses the runtime tenant context.
- Unique constraints include `tenantId`.
- Soft delete uses one representation.
- Audit rows are append-only.

### B. Pilot agreement outline

- Parties and campus.
- Scope: zones, staff, item volume.
- Success metrics and baseline.
- Data handling and retention.
- Staff responsibilities.
- Support and uptime.
- Fees, payment, and renewal.
- Termination and data return.
- Liability and disclaimer.
- Case-study permission.

### C. Onboarding checklist

- Campus name, domain, branding.
- Zones and buildings.
- Staff accounts and roles.
- Categories and tags.
- Existing item import.
- QR codes for desks.
- Notification settings.
- Baseline metrics.
- Training session.
- Support channel.

### D. Discovery questions

1. How many items per month?
2. Where are they stored?
3. Who owns the process?
4. What is the current recovery rate?
5. How long does a return take?
6. How do you prove handover?
7. What happens to unclaimed items?
8. What must stay private?
9. What budget line pays for this?
10. What would make you stop the pilot?

### E. Security checklist

- RLS runtime role applied.
- Tenant isolation tests.
- Auth and role checks.
- CSRF and rate limits.
- Image type/size validation.
- Signed URLs for private photos.
- Audit log for privileged actions.
- Data export/delete.
- Backups and restore drill.
- Dependency audit.
- Incident runbook.
- WCAG 2.2 AA.

### F. Metrics definitions

- **Recovery rate:** verified returns ÷ found items, per period.
- **Median time-to-return:** median hours from found intake to verified handover.
- **Staff hours saved:** baseline manual hours minus pilot hours.
- **Active staff:** staff who perform at least one action per week.
- **Student satisfaction:** post-handover 1–5 rating.
- **Duplicate rate:** duplicate reports ÷ total reports.
- **Unclaimed rate:** items disposed ÷ found items.

### G. Assumptions and sources

- India higher-education counts: AISHE 2021–22 scale (~1,100 universities, ~45,000 colleges).
- Global higher-education count: UNESCO-style estimate of 25,000+ institutions.
- Pricing, conversion, and retention are assumptions to validate in Phase 0.
- No purchased market report is used. The model is bottom-up.
- Legal references: DPDP Act 2023 (India), FERPA (US), WCAG 2.2.

### H. Glossary

- **Tenant:** one campus or campus group.
- **Zone:** a building, floor, desk, or campus area.
- **Intake:** the act of recording a found item.
- **Handover:** the verified transfer of an item to its owner.
- **Recovery rate:** the share of found items returned.
- **RLS:** PostgreSQL Row Level Security.
- **Pilot:** a paid, time-boxed campus deployment.

---

## 19. The next 14 days

1. Rewrite the one-page offer around “verified campus recovery,” not “lost-and-found app.”
2. Build the 50-campus list.
3. Send 30 outreaches.
4. Run 3 demos with the live app.
5. Draft the pilot SOW and baseline template.
6. Ask 5 campuses for a paid pilot.
7. Fix the two “deleted” representations and the CSV truncation signal.
8. Add tenant-safe integration tests for the item and claim routes.
9. Prepare a QR-code intake kit for campus visits.
10. Decide: paid pilot or portfolio-only.

The plan is ambitious, but the gate is simple: **one campus pays for a pilot, and the pilot beats the baseline.** If that happens, build the SaaS. If it does not, CampusHelper is still one of the strongest full-stack case studies in your portfolio.
