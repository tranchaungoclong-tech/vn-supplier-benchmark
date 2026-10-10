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
| **Customers** | Country mix (UK / USA / …) and Total / New customer counts. Then 2026 **purchase $**: BU tiles, category treemap (largest spend is the big tile), spend by customer, spend by factory. Below that: PO released by month and HO by category from **tracking** (those two are counts, not $). **Compare period** (red button) = this week/month/quarter/year vs the previous one, on PO. | HO-by-category table; PO-by-month chart |
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

After this desk is in use, the team should be able to do the following **without opening Excel**:

1. **State the Vietnam book in one sentence** — how many distinct HO, how many PO, how many factories, how many customers — from the current tracking cut, not from memory.
2. **See the calendar** — which customer-due months are heavy, which are empty, which factories sit in those months.
3. **Name delay correctly** — late = past customer due; on time = not due yet. No “early”, no invented ship date.
4. **Place customers** — UK / USA (and others when mapped), total vs new, without mixing HO counts into $.
5. **Place 2026 spend** — only from the year-purchase table: which BU, category, customer, and factory hold the **USD 6,214,799.37**. Tracking still does not pretend to have amount.
6. **Hand the same URL to a colleague** — they see the same filter, the same definitions, the same map. They do not need a new screenshot pack.

What this desk does **not** produce, and should not be quoted as a result:

- FOB, MOQ, or a costing verdict (Costing is Coming soon).
- A pass/fail quality score (defect charts are SAMPLE until a quality Excel exists).
- A live $ spend figure from ORDER TRACKING LIST 9-24 (that column is empty).

The result is **shared visibility of the Vietnam book**, with $ and quality kept on the files that actually contain them.

---

## Source rules (do not blur)

- Tracking **Total $ empty** → show “not reported”. Never show `$0`.
- **Year 2026 $** on Customers = the BU / category / client / factory table (includes A93 Storage at FarEastern + IN HOME, and DPH Ceramic Décor A74 Sanlian). Not from tracking 9-24.
- Defect rate, complaints, average defects = **SAMPLE** until a separate quality file exists.
- This desk is **not** the QA inspection board and **not** a costing sheet.
