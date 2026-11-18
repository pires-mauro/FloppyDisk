# Acceptance tests

Based on the [functional requirements and acceptance criteria](../../Week_6_Functional_Requirements_and_Acceptance_Criteria.pdf).

**Latest test results (18 November 2026):** 25 Python test methods run: 21 passed and 4 contain failures (8 failed assertions/subtests). Only the critical component has been tested so far; browser and database testing is still pending.

**Statuses:** Passed = tested successfully; Failed = an issue was found; Partial = some checks passed but others remain; Not tested = testing still needed.

| Requirement | What needs to pass | Testing method | Status | Result / notes |
| --- | --- | --- | --- | --- |
| FR-01 — Mandatory fields | Required fields are marked and highlighted when empty. Submission is blocked, with the specified red-flag exception. | Manual browser test | Not tested | Clarify which buttons the red-flag exception applies to. |
| FR-02 — Dropdowns | Only the predefined country, income, profession and marital-status values can be selected. | Manual browser test + API test | Not tested | Check each list and try invalid values. |
| FR-03 — Field validation | Officer IDs contain exactly 10 digits; invalid emails are rejected; name/ID limits are 100 characters and comments 500; phone format is correct. | Python API tests + manual browser test | Not tested | Check valid, invalid and boundary inputs, including the displayed errors. |
| FR-04 — Date of birth | Future dates and clients under 18 are rejected; clients aged 18 or older are accepted. The calendar uses DD-MM-YYYY. | Python API tests + manual browser test | Not tested | Include exactly 18 and one day too young. |
| FR-05 — Saving clients | Complete client and assessment data is saved only after the final decision. | Database test + manual browser test | Not tested | Compare submitted values with saved records. |
| FR-06 — Client overview | Saved records display correctly and can be filtered or sorted by client ID and risk tier. | Database test + manual browser test | Not tested | Check required columns, search and sorting. |
| FR-07 — Risk calculation | Floor the weighted average to two decimals, with correct Low, Medium and High tiers. | Python calculation + critical API tests | Failed | Agreed range: 0-5. Flooring checks fail: 2.4999 returns 2.50 instead of 2.49; 3.7499 returns 3.75 instead of 3.74. Tier checks pass. |
| FR-08 — Live preview | Changing a scoring field updates the preview within 500 ms without reloading. Unselected fields have zero weight. | Manual browser test | Not tested | Backend zero-weight arithmetic passed; live preview still needs testing. |
| FR-09 — Red-flag override | PEP or sanctions forces High Risk even with lowest-risk inputs, and a banner explains the reason. | Critical API tests + manual browser test | Partial | All 3 API override checks now pass. Banner not tested. |
| FR-10 — Decision buttons | Only Approve is enabled for Low Risk, Manual Review for Medium Risk, and Decline for High Risk/red flags. | Manual browser test + main API test | Not tested | Verify both button states and submitted decisions. |
| FR-11 — Duplicate clients | An existing ID number and issuing-country combination blocks saving and displays an alert. | Database test + manual browser test | Not tested | Also check that a different issuing country is not treated as the same combination. |
| FR-12 — Display results | Every factor displays its value, weight and score. The reference result is correct and repeatable. | Python tests + manual browser test | Partial | Calculation, contributions and repeatability passed. Screen display not tested. |
| FR-13 — Change weights | Changes apply only after Save; leaving without saving keeps old values. A suitable weight change alters the score. | API + database + manual browser test | Not tested | Use a profile with different factor scores when checking the effect. |
| FR-14 — Change risk values | Changes apply only after Save; leaving without saving keeps old values. Changing a selected risk value alters the score. | API + database + manual browser test | Not tested | Compare results before and after saving. |
| FR-15 — Audit logs | Changes record the employee, time and configuration version. Final onboarding records reference their version, and new calculations use the latest saved version. | API + database test | Not tested | Check saved history and links to onboarding records. |

## FR-09 retest

The updated critical API now returns **High Risk** when PEP, sanctions, or both are enabled. All three previously failing tests pass. These tests remain as regression checks. Browser behavior and the banner still need separate verification.

## Python tests

- [Calculation tests](../../apps/critical/tests/test_scoring.py)
- [Boundary and API tests](../../apps/critical/tests/test_critical_api.py)

Additional boundary checks passed for invalid scores, negative/zero weights, empty or mismatched factors, missing inputs and non-finite numbers.

To run from `apps/critical`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tests/requirements.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

The suite currently reports 25 test methods: 21 pass and 4 contain failures. Unittest reports 8 failures because it counts failed subtests individually. No database or running Docker containers are needed.


## Flooring rule (FR-07)

The agreed rule is to floor the final weighted score to two decimals, not round to nearest. Tests assert 2.4999 becomes 2.49 / Low Risk, 3.7499 becomes 3.74 / Medium Risk, and exact thresholds 2.50 and 3.75 retain their tiers. The five-factor example now expects 3.66 from 55/15, and 0.9999 must return 0.99. The application still uses round(score, 2), so the flooring checks intentionally fail until developers implement the rule. Application code is unchanged.

