# VN Supplier Benchmark

Live: https://tranchaungoclong-tech.github.io/vn-supplier-benchmark/

This page is Alpha Fashion’s **Vietnam order desk**. It turns the live order-tracking Excel into one screen so sourcing, merchandising, and management can see volume, timing, factories, and customers **without opening the spreadsheet**.

It is **not** a finance dashboard and **not** a quality-audit system. Those modules are marked Coming soon until their own files exist.

---

## What problem it solves

The tracking file (`ORDER TRACKING LIST 9-24`) is the working record of Vietnam-handled orders: hundreds of SKU / port lines, many house orders (HO), many purchase orders (PO), ten factories.

In Excel that record is hard to *read as a picture*:

- You cannot see, in one glance, **how many HO fall in each month** of the customer calendar.
- You cannot see **which factory carries the book**, or **which customers sit in UK vs USA**.
- You cannot tell **late vs not-due-yet** without scanning due dates row by row.
- The **amount column is empty**. If someone treats a blank cell as `$0`, spend looks like a collapse. This desk refuses that.

So the desk answers three operational questions:

1. **What is on the Vietnam book right now?** Distinct HO, PO, factories, customers — from the tracking file only.
2. **When is it due, and is it late?** Month and delay are based on **customer delivery time**, not order date.
3. **Where did 2026 purchase $ actually sit?** Only when a separate year-purchase table is supplied. That $ is **not** invented from HO counts.

Current tracking snapshot (file dated 3 Oct 2026): **605 Excel lines · 10 factories · 134 distinct HO · 393 distinct PO · $ not reported in tracking.**

Current year-purchase table (Philip’s BU / category / client / factory sheet): **USD 6,214,799.37** for 2026.

---

## How to use

Open the live link. One filter bar at the top applies to every page (factory, location, customer, category, period, date band, new vs repeat). Change a filter once; Dashboard, Factories, Customers, and Order book all follow it.

| Page | What you look at | What you must not treat as $ |
| --- | --- | --- |
| **Dashboard** | Distinct HO (with PO and Excel-line counts under it). Spend tile says *not reported* until tracking has amount. Delay mix and customer mix. HO by month. Asia map: bar length = HO, pin colour = factory, label = factory code + name. | HO / PO counts |
| **Factories** | Stacked HO by factory × customer-due month (Jan–Dec always shown; empty month = 0). Delivery time: **On time = not due yet**, **Late = past customer due**. There is **no Early** — the file has no actual ship date. Defect / complaint charts are **SAMPLE** until a quality Excel exists. Map sits beside Quality Performance. | HO stacks, SAMPLE defect % |
| **Customers** | Country mix on **one row** (USA / UK chips + Total / New). Then 2026 **purchase $**: **customer donut + category treemap on one row** (donut hole = year total; slices = customer; largest category is the big tile), then spend by customer and spend by factory. Below that: **HO by month** and HO by category from **tracking** (counts, not $). Month bucket = customer due. **Compare period** (red button) = this week/month/quarter/year vs the previous one, on PO. | HO-by-month chart; HO-by-category table |
| **Order book** | Every SKU / port line in the current filter. Export downloads **that filter**, not the whole Excel. | Line qty is pieces, not $ |
| **Merchandiser / Costing / Designer / Quality library** | Marked **Coming soon**. Costing and Designer stay SAMPLE until a costing Excel / spec pack is provided. | Do not fill FOB, MOQ, or artwork from tracking |

**Location:** country first (Vietnam / Cambodia / Thailand). Hover Vietnam for North / Middle / South. North = Ha Noi, Ninh Binh, Vinh Phuc. Middle is empty until a factory is pinned there. The rest of the pinned plants sit in South.

**New tracking file:** there is **no Import button** on the public page. Send the new Excel; the live desk is rebuilt from that file and the change is reported. Do not paste invented $ into a blank Total column.

---

## Re-use value

“Re-use value” means: **this desk is built so the next month’s file can sit in the same frame**, instead of building a new report from screenshots every time.

What you keep and reuse:

- **The same screen** for the team — one URL, not a new PowerPoint each week.
- **The same filters and definitions** — HO vs PO vs Excel line; customer due vs order date; On time vs Late; country codes (e.g. U09 / G35 = UK, A74 = USA).
- **The same factory map** — pins and colours stay; only HO counts move when the file updates.
- **The same split of sources** — tracking for volume and dates; the year-purchase table for $. They are never mixed.

What you replace when the book moves:

- A new `ORDER TRACKING LIST` Excel → rebuild the live page.
- An updated year-purchase table → Customers $ charts change; tracking HO charts do not pretend to be $.
- A monthly / quarterly defect Excel → SAMPLE quality charts can become real. Until then they stay labelled SAMPLE.

If the tracking file is not refreshed, the numbers stay on the 9-24 cut. The layout is still the place the next cut lands.

---

## Result

The result is not “we built a dashboard.” The result is **time back on the Vietnam book**, and **one shared picture** instead of five people reading five Excel filters.

### Time it saves — and how

Before this desk, a typical ask (“how heavy is October?”, “which factory is late?”, “UK vs USA?”, “what did we buy in 2026?”) meant:

1. Open the tracking workbook.
2. Filter / pivot / scroll hundreds of SKU–port lines.
3. Count HO and PO by hand (or hope the pivot did not double-count lines).
4. Check customer due vs today, one row at a time.
5. Screenshot or paste into chat / PPT — then do it again next week, because the screenshot is already stale.

That loop is **15–40 minutes per question**, and longer if two people get different counts from different filters.

With the desk, the same question is **one URL + one filter**, usually **under a minute**:

| Old way (Excel) | On this desk |
| --- | --- |
| Pivot HO by month, then check you used **customer due**, not order date | Dashboard / Factories already bucket by customer due; empty months show 0 |
| Scan due dates to label late | Delay mix + Factories Delivery Time: Late = past customer due; On time = not due yet |
| Count customers, guess UK vs USA | Customers page: country bar + Total / New |
| Sum 2026 $ from a second yellow table, then chart it | Customers $ charts already hold **USD 6,214,799.37** from that table |
| Send a screenshot; colleague asks “which filter?” | Same live link; their filter is visible |

**Rough saving:** one weekly book-check that used to take a long Excel pass (often **30–60 minutes** to answer several of those questions and paste charts) drops to **a few minutes of reading the live page**. That time goes back to chasing factories and dates — the actual sourcing work — not rebuilding the same pivot.

### How effective it is

Effectiveness here means: **the team agrees on the same numbers, the same week, without a new file.**

- **One count of the book** — 134 HO · 393 PO · 10 factories · 8 customers on the current cut. Not “I got 140, you got 128” because one person counted Excel lines and the other counted HO.
- **One clock** — customer delivery time. Order date is not used for the month charts, so October/November/December volume is not missing just because order date stopped in September.
- **One rule on money** — tracking $ empty stays “not reported.” 2026 spend is only the year table. Nobody presents a fake $0 collapse, and nobody mixes HO bars into a spend story.
- **One map** — factory code + name, colour = that factory’s HO bar. Location talk (North / South) sits on the same pins.
- **Reusable next month** — new tracking Excel in, same screen out. No new PowerPoint template for the same four questions.

### What “good” looks like in practice

A merchandiser or manager can open the link before a meeting and already know: which months are loaded, which factory is carrying HO, which customers are new, where 2026 $ sat (Candle / QGBG / U09…), and what is late — **without asking someone to “pull the Excel.”**

### What is not a result of this desk

Do not quote this page as:

- a costing or FOB verdict (Costing is Coming soon);
- a quality pass/fail score (defect charts are SAMPLE until a quality Excel exists);
- live spend from ORDER TRACKING LIST 9-24 (that column is empty).

Those answers still need their own files. This desk’s result is **shared, repeatable visibility of volume, timing, factories, customers, and the 2026 $ table** — faster than Excel, and the same for everyone who opens the URL.

---

## Source rules (do not blur)

- Tracking **Total $ empty** → show “not reported”. Never show `$0`.
- **Year 2026 $** on Customers = the BU / category / client / factory table (includes A93 Storage at FarEastern + IN HOME, and DPH Ceramic Décor A74 Sanlian). Not from tracking 9-24.
- Defect rate, complaints, average defects = **SAMPLE** until a separate quality file exists.
- This desk is **not** the QA inspection board and **not** a costing sheet.
