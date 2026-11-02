# Reconciliation Test Fixtures

## Demo set with answer key — `demo-august-2026/`

Synthetic August 2026 extracts in the real layouts (Prism payments, Netting
download, four bank statements) and `ANSWER KEY (DEMO).xlsx`, which gives the
balance reconciliation front-page figures and lists every planted exception.
`src/lib/demo-answer-key.test.ts` runs the files through the full pipeline
and checks both against the answer key, so `pnpm test` fails if a change to
cleaning, matching or the report moves any figure.

## CSV samples

These CSV files are sample extracts for testing the matching engine without
needing real Dynamics/Prism/bank integrations.

## Files

| File                  | Source         | Rows | Purpose                                |
| --------------------- | -------------- | ---- | -------------------------------------- |
| `dynamics-sample.csv` | Dynamics 365   | 30   | Baseline ledger records                |
| `prism-sample.csv`    | Prism BSS      | 30   | Billing records with deliberate issues |
| `bank-sample.csv`     | Bank statement | 29   | Bank records with deliberate issues    |

## How to use

1. Go to **Data Sources** in the app.
2. Upload each file under the matching source type.
3. Go to **Overview** to see the reconciliation results.

## Deliberate test scenarios built in

| Reference     | Scenario                                                       | Expected result                  |
| ------------- | -------------------------------------------------------------- | -------------------------------- |
| INV-001       | Same date, amount, and reference across all 3 sources          | **Matched**                      |
| INV-002       | Same amount/reference, dates differ by 1-2 days across sources | **Timing**                       |
| INV-003       | Prism amount is 14,800 vs Dynamics/Bank 15,000                 | **Mispost**                      |
| INV-004       | Only in Dynamics                                               | **Investigate**                  |
| INV-005       | In Dynamics and Prism, missing from Bank                       | **Investigate** (missing source) |
| INV-009       | Prism date is 1 day later than Dynamics/Bank                   | **Timing**                       |
| INV-010       | Duplicated row in Prism                                        | **Possible Duplicates** panel    |
| INV-025       | Only in Dynamics                                               | **Investigate**                  |
| BANK-ONLY-001 | Only in Bank                                                   | **Investigate**                  |

## Column headers

The parser auto-detects columns using these headers:

- **Date** — `Date`, `Posted`, `Txn Date`, `Transaction Date`, `Value Date`
- **Reference / ID** — `Reference`, `Ref`, `ID`, `Trans`, `Narrative`, `ZOL`
- **Amount** — `Amount`, `Value`, `Net`, `Total`
- **Currency** — `Currency`, `CCY`, `Curr`

For bank statements with separate **Debit** and **Credit** columns, the parser
will synthesize a `Net Amount (Credit − Debit)` column automatically.
