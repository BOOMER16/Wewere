# RetireSafe — research & proposed solution

Hacker Sprint / Manipal Bengaluru. Evidence-driven workflow for safely retiring
cloud resources (preventing subdomain/bucket/reference takeover at retirement).

This repo holds the **research dossier** and the **test beds** behind it. Every
number in the PDF traces to a script here and a committed output file; all
network lookups are read-only.

## Deliverable
`testbeds/RetireSafe_Solution_Dossier.pdf`

## Test beds (run on real public data)
- `testbeds/tb1_dns_cname.py` — base rate of surviving reclaimable references
  across 16,000 real hostnames (Cisco Umbrella top-1M + can-i-take-over-xyz
  fingerprints + live S3 probe). → `results/tb1_summary.json`
- `testbeds/tb2_traffic_survival.py` — Poisson traffic-survival / quarantine
  model + hold-out calibration on the NASA-HTTP 1995 log (1.89M requests).
  → `results/tb2_summary.json`
- `testbeds/tb3_blast_radius.py` — the coordination gap, quantified: "idle"
  resources with hidden external dependents. → `results/tb3_summary.json`

## Reproduce
Data is fetched to `/home/user/data` (not committed): Umbrella top-1M,
greymd/NASA-HTTP, EdOverflow/can-i-take-over-xyz. Then:
```
cd testbeds
python3 tb1_dns_cname.py      # needs network (DNS + S3)
python3 tb2_traffic_survival.py
python3 tb3_blast_radius.py
python3 make_figs.py && python3 make_pdf.py
```
