# Industry use cases

FairShift uses one data model for every sector: **organisation, site, team, worker, shift**. Only the vocabulary, the hazard categories and the seed data change. Construction and college campuses are built and demoed. Hospitals use the same model and are described here.

|                       | Construction                                                          | College campus                                                    | Hospital                                                                                   |
| --------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Status                | Built and demoed                                                      | Built and demoed                                                  | Same model, documented                                                                     |
| Example               | Skyline Towers, Chennai                                               | Campus facilities                                                 | Ward support services                                                                      |
| Typical workers       | Masons, helpers, electricians, plumbers                               | Housekeeping, security, maintenance                               | Sanitation, ward attendants, porters, security                                             |
| Pay                   | Mostly daily wage                                                     | Mostly monthly salary                                             | Monthly, with night and shift allowances                                                   |
| Shift pattern         | One long day shift, often with overtime                               | Day shifts plus night security                                    | Round-the-clock rotas, 8 or 12 hour blocks                                                 |
| Check-in              | Rotating QR at the site gate, or GPS                                  | QR at each building, or GPS                                       | QR at the ward or department door                                                          |
| Top fatigue risk      | More than 48 hours a week, long days before a deadline                | Night-shift security, double duty in exam weeks                   | Back-to-back shifts with under 10 hours of rest                                            |
| Top hazards           | Exposed electrical lines, scaffolding, open trenches, falling objects | Wet floors, chemical storage, broken lifts, poor ventilation      | Sharps and needle-stick, infection exposure, patient handling, oxygen and chemical storage |
| Feedback themes       | Safety equipment, supervisor respect, pay delays                      | Workload in peak weeks, supplies, respect from staff and students | Staffing levels, rest between shifts, safety on night rounds                               |
| Why quit risk matters | Seasonal churn between sites                                          | Contract turnover                                                 | Burnout and night-shift attrition                                                          |

## Construction

Gate check-in with a QR code that changes every 60 seconds proves who was on site. Daily wages with overtime past 8 hours a day or 48 a week are shown line by line, so a mason can see the double rate applied. A scaffolding or live-wire report goes to the site lead with a one-hour acknowledgement deadline if it is critical, and escalates by itself if nobody responds. The skill passport carries a worker's scaffolding or electrical training to the next contractor.

## College campus

Housekeeping, security and maintenance staff often work for a contractor, not the college, and have no record of their own hours. FairShift gives them that record in Tamil or Hindi. Night-shift security gets rest-gap alerts. A report about a wet staircase or a stuck exhaust fan reaches the facilities director with a deadline, and the worker sees when it is acknowledged and resolved.

## Hospital

The same model fits without code changes to the rule engines:

- **Organisation and site:** the hospital and each department or ward.
- **Teams:** sanitation, ward attendants, porters, security.
- **Shifts:** 8 and 12 hour rotas. The fatigue engine already flags rest gaps under 10 hours and 7 days without a day off, which matter most for night rotas.
- **Hazards:** add sector categories (sharps, infection exposure, patient handling) to the hazard form. SLA deadlines by severity stay the same.
- **Feedback:** the four questions apply as they are. The k = 3 rule matters even more in small wards, where a team of four is easy to identify.
- **Payslips:** add shift and night allowances to the payslip lines. Deductions are configured per organisation.

What a hospital deployment would still need is a data-protection review of any patient-adjacent hazard descriptions. FairShift stores no patient data and its free-text fields are scrubbed for names and phone numbers.
