# PT validation: published charts vs CoolProp bake

Research worker, 2026-10-23 (about 35 minutes). Machine-readable values: `/home/joseph/hvac-field/research/pt-published.json`.

Method: PDFs were read through `pdftotext -layout` held in memory, so nothing was saved to disk. Values are the printed digits from each chart's text layer. Nothing was interpolated or computed. No page was rendered and compared by eye (OPEN).

## What this means for the build

1. Ten of twelve refrigerants have liquid and vapor psig at all eight temperatures from a published chart: R-454B, R-448A, R-449A, R-513A, R-407A, R-452A, R-422D, R-407C, R-404A, R-410A. R-32 is pure, so one value is copied into both fields. R-407F is the gap. The only chart found (Hudson) has one unlabeled column, so the JSON carries nulls for it. Its values are in the notes below. OPEN: a second R-407F source with a liquid/vapor split.

2. The Arkema charts are generated, not measured. The R-407A sheet footer reads "This data was generated using the NIST REFPROP Database" (REFPROP 9.0). The 407C, 404A and 410A sheets share that template; I did not check their footers one by one. Agreement with a CoolProp bake therefore tests CoolProp against REFPROP, not against field pressures (inference).

3. Sources disagree by roughly 1 to 3 psi, which sets the floor for any validation tolerance (inference: a tighter tolerance cannot be checked against the published charts). Values as printed: R-404A at 100 F, Arkema 236.8 liquid / 234.6 vapor, Hudson single column 234.0. R-410A at 90 F, Arkema 275.4 / 274.5, Hudson 274.0. R-454B at 90 F, Arkema 260.1 / 251.0, Chadwell A2L chart 262.50 / 251.90.

4. Honeywell-form charts give bubble and dew temperature at a psig row, not psig at a temperature. The rsd.net copy of the Solstice N40 chart, the meiersupply copy, and the Honeywell R-454B PT chart are all this form. They cannot go into the psig fields without inversion, which I did not do. Validate them in the temperature domain: compare CoolProp bubble and dew temperatures at the chart's psig rows. The Honeywell R-454B PDF link returned an HTML page, so it was not read.

5. Single-column charts (Hudson R-32, R-404A, R-410A, R-454B, R-513A, R-407F) do not say whether a value is bubble or dew. For R-454B, Hudson's single column matches Arkema's liquid column within 0.2 psi at every temperature, which suggests bubble (inference).

6. Charging references. The best published references in hand are from the California Energy Commission: Residential ACM Manual Appendix RD-2005, Table RD-2 (target superheat) and Table RD-3 (target temperature split). Both are indexed by return-air wet-bulb, not relative humidity, so the build must convert RH to wet-bulb psychrometrically. I did not do that. The airflow basis is 400 cfm per 12,000 Btu/h (0.033 cfm/Btu), stated in section RD.2.6. The manufacturer piston table (Carrier, Bryant, Goodman, Rheem, Trane, Lennox) is OPEN.

## Per-refrigerant notes

### R-454B
- Source: Arkema "Forane Ref PT Regular Chart EN", R-454B Liquid and Vapor columns, PRESSURE (PSIG), all eight points. The same chart carries R-513A.
- Cross-checks: Hudson single column matches Arkema liquid within 0.2 psi. Chadwell A2L chart reads higher than Arkema across the range: liquid 24.90 at -20 F and 262.50 at 90 F, against Arkema 24.3 and 260.1.
- Oddity: the Honeywell PT chart URL returned HTML, so the Honeywell original was not read (OPEN).

### R-448A
- Source: Hudson R-448A PT chart, Liquid and Vapor psig columns (header confirmed).
- Honeywell N40 copies (rsd.net, meiersupply) are psig-to-temperature. Example from the rsd.net copy at 0 psig: Solstice N40 bubble -50.7 F, dew -39.6 F. Not used in the JSON.
- OPEN: an official Honeywell or Chemours R-448A chart in psig-at-temperature form.

### R-449A
- Source: Hudson R-449A PT chart, Liquid and Vapor psig columns (header confirmed).
- A Chemours Opteon XP40 datasheet copy (meiersupply) was found but not parsed (OPEN).

### R-513A
- Source: Arkema Forane EN chart, R-513A Liquid and Vapor columns. Values are small at low temperature (0.5 psi at -20 F).
- Hudson single column is within 0.6 psi of the Arkema columns: -20 0.1; 0 9.1; 20 21.9; 40 39.6; 90 112.0; 100 132.0; 110 155.0; 120 180.0.
- A Chemours Opteon XP10 "TEMPCHART" copy (meiersupply) is psig-to-temperature. Not parsed (OPEN).

### R-407A
- Source: Arkema 407A saturation P-T sheet, Liquid and Vapor psig. Footer cites NIST REFPROP 9.0.
- A DuPont/Suva 407A guide (wizard.youngsupply.com) was found but not read (OPEN).

### R-407F
- Source: Hudson R-407F PT chart. One psig column headed "R-407F" with no liquid or vapor label. Not placed in the JSON fields.
- Single-column values, psig as printed: -20 17.1; 0 34.5; 20 58.5; 40 90.3; 90 215.0; 100 249.3; 110 287.2; 120 329.0.
- The chart footnote gives liquid boiling point as -50.9 F (as printed).
- OPEN: a second source with liquid and vapor columns.

### R-452A
- Source: Hudson R-452A PT chart, Liquid and Vapor psig columns (header confirmed).
- No second source found. The Arkema combined chart content I read did not show R-452A. Chemours Opteon XP44 literature not found (OPEN).

### R-422D
- Source: A-Gas technical information sheet (file r422d), Liquid and Vapor psig.
- Oddity: the header block reads "Physical Properties of Refrigerants R407C", but the property block (molecular weight 109.9, GWP 2730, boiling point -45.8 F, critical pressure 566.2 psia) and the table match R-422D. Hudson's R-422D PT chart gives identical values at all eight temperatures.
- Precision changes: the chart prints whole psi at 90 F and above.

### R-407C
- Source: Arkema 407C saturation P-T sheet, Liquid and Vapor psig.
- Cross-check: the lower block of the Arkema combined chart repeats the same 407C values at 40 F (80.2 / 63.2).
- Hudson R-407C not read (OPEN).

### R-404A
- Source: Arkema 404A saturation P-T sheet, Liquid and Vapor psig.
- Hudson single column runs at or below Arkema's vapor column at most temperatures. At 100 F: Hudson 234.0, Arkema vapor 234.6, Arkema liquid 236.8 (inference: a different property basis).
- The Arkema combined chart's lower block shows R-404A at 40 F as 86.9 liquid, matching the standalone sheet.

### R-32
- Source: Hudson R-32 PT chart, single pure-fluid column, copied into both fields.
- The Chadwell A2L chart matches at every temperature except 0 F (Chadwell 49.20, Hudson 49.3).

### R-410A
- Source: Arkema 410A saturation P-T sheet, Liquid and Vapor psig.
- Hudson single column (-20 26.9; 0 48.6; 20 78.3; 40 118.0; 90 274.0; 100 317.0; 110 365.0; 120 418.0) sits between about 1.6 psi below and 0.6 psi above Arkema's liquid column.
- The Chadwell A2L chart matches Arkema at all eight points.

## Charging reference A: target superheat for fixed-orifice (piston) systems

- Manufacturer piston table: OPEN. Three search passes returned forum threads, garbled pages and a Goodman TXV manual, but no outdoor-dry-bulb by indoor-wet-bulb grid from Carrier, Bryant, Goodman, Rheem, Trane or Lennox.
- Fallback, government source: California Energy Commission Residential ACM Manual, Appendix RD-2005, Table RD-2 (Target Superheat). The copy read is hosted by Tru-Tech Tools (trutechtools.com), not the CEC site. Not checked against the CEC original (OPEN).
- Axes: columns are return-air wet-bulb (F), starting at 50; rows are condenser air dry-bulb (F), starting at 55. Values are target superheat (suction line temperature minus evaporator saturation temperature). Pass band: actual superheat within plus or minus 5 F of target (RD2 measurement procedure, steps 4 to 6).
- A dash means the target is under 5 F. The appendix says that fails the charge test, usually because outdoor conditions are too hot and dry (RD2 procedure, step 3).
- Verbatim text-layer copy (pdftotext -layout, not hand-typed; running headers and footers removed). Page 1 of Table RD-2:

```text
Table RD-2: Target Superheat (Suction Line Temperature - Evaporator Saturation Temperature)
                                                                                                 Return Air Wet-Bulb Temperature (°F)
                                                                                                              (T return, wb)
                                                 50 51     52   53   54   55 56     57   58   59   60 61     62   63   64   65 66     67   68   69   70 71     72   73   74   75 76
                                            55   8.8 10.1 11.5 12.8 14.2 15.6 17.1 18.5 20.0 21.5 23.1 24.6 26.2 27.8 29.4 31.0 32.4 33.8 35.1 36.4 37.7 39.0 40.2 41.5 42.7 43.9 45.0
                                            56   8.6 9.9 11.2 12.6 14.0 15.4 16.8 18.2 19.7 21.2 22.7 24.2 25.7 27.3 28.9 30.5 31.8 33.2 34.6 35.9 37.2 38.5 39.7 41.0 42.2 43.4 44.6
                                            57   8.3 9.6 11.0 12.3 13.7 15.1 16.5 17.9 19.4 20.8 22.3 23.8 25.3 26.8 28.3 29.9 31.3 32.6 34.0 35.3 36.7 38.0 39.2 40.5 41.7 43.0 44.2
                                            58   7.9 9.3 10.6 12.0 13.4 14.8 16.2 17.6 19.0 20.4 21.9 23.3 24.8 26.3 27.8 29.3 30.7 32.1 33.5 34.8 36.1 37.5 38.7 40.0 41.3 42.5 43.7
                                            59   7.5 8.9 10.2 11.6 13.0 14.4 15.8 17.2 18.6 20.0 21.4 22.9 24.3 25.7 27.2 28.7 30.1 31.5 32.9 34.3 35.6 36.9 38.3 39.5 40.8 42.1 43.3
                                            60   7.0 8.4 9.8 11.2 12.6 14.0 15.4 16.8 18.2 19.6 21.0 22.4 23.8 25.2 26.6 28.1 29.6 31.0 32.4 33.7 35.1 36.4 37.8 39.1 40.4 41.6 42.9
                                            61   6.5 7.9 9.3 10.7 12.1 13.5 14.9 16.3 17.7 19.1 20.5 21.9 23.3 24.7 26.1 27.5 29.0 30.4 31.8 33.2 34.6 35.9 37.3 38.6 39.9 41.2 42.4
                                            62   6.0 7.4 8.8 10.2 11.7 13.1 14.5 15.9 17.3 18.7 20.1 21.4 22.8 24.2 25.5 27.0 28.4 29.9 31.3 32.7 34.1 35.4 36.8 38.1 39.4 40.7 42.0
                                            63   5.3 6.8 8.3 9.7 11.1 12.6 14.0 15.4 16.8 18.2 19.6 20.9 22.3 23.6 25.0 26.4 27.8 29.3 30.7 32.2 33.6 34.9 36.3 37.7 39.0 40.3 41.6
                                            64    -  6.1 7.6 9.1 10.6 12.0 13.5 14.9 16.3 17.7 19.0 20.4 21.7 23.1 24.4 25.8 27.3 28.7 30.2 31.6 33.0 34.4 35.8 37.2 38.5 39.9 41.2
                                            65    -  5.4 7.0 8.5 10.0 11.5 12.9 14.3 15.8 17.1 18.5 19.9 21.2 22.5 23.8 25.2 26.7 28.2 29.7 31.1 32.5 33.9 35.3 36.7 38.1 39.4 40.8
 Condenser Air Dry-Bulb Temperature (°F)
                                            66    -       6.3 7.8 9.3 10.8 12.3 13.8 15.2 16.6 18.0 19.3 20.7 22.0 23.2 24.6 26.1 27.6 29.1 30.6 32.0 33.4 34.9 36.3 37.6 39.0 40.4
                                            67    -   -   5.5 7.1 8.7 10.2 11.7 13.2 14.6 16.0 17.4 18.8 20.1 21.4 22.7 24.1 25.6 27.1 28.6 30.1 31.5 33.0 34.4 35.8 37.2 38.6 39.9
                                            68    -   -     -  6.3 8.0 9.5 11.1 12.6 14.0 15.5 16.8 18.2 19.5 20.8 22.1 23.5 25.0 26.5 28.0 29.5 31.0 32.5 33.9 35.3 36.8 38.1 39.5
                                            69    -   -     -  5.5 7.2 8.8 10.4 11.9 13.4 14.8 16.3 17.6 19.0 20.3 21.5 22.9 24.4 26.0 27.5 29.0 30.5 32.0 33.4 34.9 36.3 37.7 39.1
                                            70    -   -     -    -  6.4 8.1 9.7 11.2 12.7 14.2 15.7 17.0 18.4 19.7 20.9 22.3 23.9 25.4 27.0 28.5 30.0 31.5 33.0 34.4 35.9 37.3 38.7
                                            71    -   -     -    -  5.6 7.3 8.9 10.5 12.1 13.6 15.0 16.4 17.8 19.1 20.3 21.7 23.3 24.9 26.4 28.0 29.5 31.0 32.5 34.0 35.4 36.9 38.3
                                            72    -   -     -    -    -  6.4 8.1 9.8 11.4 12.9 14.4 15.8 17.2 18.5 19.7 21.2 22.8 24.3 25.9 27.4 29.0 30.5 32.0 33.5 35.0 36.5 37.9
                                            73    -   -     -    -    -  5.6 7.3 9.0 10.7 12.2 13.7 15.2 16.6 17.9 19.2 20.6 22.2 23.8 25.4 26.9 28.5 30.0 31.5 33.1 34.6 36.0 37.5
                                            74    -   -     -    -    -    -  6.5 8.2 9.9 11.5 13.1 14.5 15.9 17.3 18.6 20.0 21.6 23.2 24.8 26.4 28.0 29.5 31.1 32.6 34.1 35.6 37.1
                                            75    -   -     -    -    -    -  5.6 7.4 9.2 10.8 12.4 13.9 15.3 16.7 18.0 19.4 21.1 22.7 24.3 25.9 27.5 29.1 30.6 32.2 33.7 35.2 36.7
                                            76    -   -     -    -    -    -   -   6.6 8.4 10.1 11.7 13.2 14.7 16.1 17.4 18.9 20.5 22.1 23.8 25.4 27.0 28.6 30.1 31.7 33.3 34.8 36.3
                                            77    -   -     -    -    -    -   -   5.7 7.5 9.3 11.0 12.5 14.0 15.4 16.8 18.3 20.0 21.6 23.2 24.9 26.5 28.1 29.7 31.3 32.8 34.4 36.0
                                            78    -   -     -    -    -    -   -     -  6.7 8.5 10.2 11.8 13.4 14.8 16.2 17.7 19.4 21.1 22.7 24.4 26.0 27.6 29.2 30.8 32.4 34.0 35.6
                                            79    -   -     -    -    -    -   -     -  5.9 7.7 9.5 11.1 12.7 14.2 15.6 17.1 18.8 20.5 22.2 23.8 25.5 27.1 28.8 30.4 32.0 33.6 35.2
                                            80    -   -     -    -    -    -   -     -    -  6.9 8.7 10.4 12.0 13.5 15.0 16.6 18.3 20.0 21.7 23.3 25.0 26.7 28.3 29.9 31.6 33.2 34.8
                                            81    -   -     -    -    -    -   -     -    -  6.0 7.9 9.7 11.3 12.9 14.3 16.0 17.7 19.4 21.1 22.8 24.5 26.2 27.9 29.5 31.2 32.8 34.4
                                            82    -   -     -    -    -    -   -     -    -  5.2 7.1 8.9 10.6 12.2 13.7 15.4 17.2 18.9 20.6 22.3 24.0 25.7 27.4 29.1 30.7 32.4 34.0
                                            83    -   -     -    -    -    -   -     -    -    -  6.3 8.2 9.9 11.6 13.1 14.9 16.6 18.4 20.1 21.8 23.5 25.2 26.9 28.6 30.3 32.0 33.7
                                            84    -   -     -    -    -    -   -     -    -    -  5.5 7.4 9.2 10.9 12.5 14.3 16.1 17.8 19.6 21.3 23.0 24.8 26.5 28.2 29.9 31.6 33.3
                                            85    -   -     -    -    -    -   -     -    -    -    -  6.6 8.5 10.3 11.9 13.7 15.5 17.3 19.0 20.8 22.6 24.3 26.0 27.8 29.5 31.2 32.9
                                            86    -   -     -    -    -    -   -     -    -    -    -  5.8 7.8 9.6 11.3 13.2 15.0 16.7 18.5 20.3 22.1 23.8 25.6 27.3 29.1 30.8 32.6
                                           )
                                            87    -   -     -    -    -    -   -     -    -    -    -  5.0 7.0 8.9 10.6 12.6 14.4 16.2 18.0 19.8 21.6 23.4 25.1 26.9 28.7 30.4 32.2
                                            88    -   -     -    -    -    -   -     -    -    -    -   -   6.3 8.2 10.0 12.0 13.9 15.7 17.5 19.3 21.1 22.9 24.7 26.5 28.3 30.1 31.8
                                            89    -   -     -    -    -    -   -     -    -    -    -   -   5.5 7.5 9.4 11.5 13.3 15.1 17.0 18.8 20.6 22.4 24.3 26.1 27.9 29.7 31.5
                                           (T
                                            90    -   -     -    -    -    -   -     -    -    -    -   -     -  6.8 8.8 10.9 12.8 14.6 16.5 18.3 20.1 22.0 23.8 25.6 27.5 29.3 31.1
Greyed area indicates test conditions where the return drybulb temperature must exceed 70°F
```

- Table RD-2, continued:

```text
Table RD-2: Target Superheat (Suction Line Temperature - Evaporator Saturation Temperature) (continued)
                                                                                                     Return Air Wet-Bulb Temperature (°F)
                                                                                                                     (T return, wb)
                                                   50   51   52   53   54   55   56   57   58   59    60   61   62        63      64      65    66    67    68    69    70   71   72   73   74   75   76
                                              91   -    -    -    -    -    -    -    -    -    -      -    -    -       6.1     8.1 10.3 12.2 14.1 15.9 17.8 19.7 21.5 23.4 25.2 27.1 28.9 30.8
                                              92   -    -    -    -    -    -    -    -    -    -      -    -    -       5.4     7.5      9.8 11.7 13.5 15.4 17.3 19.2 21.1 22.9 24.8 26.7 28.5 30.4
                                              93   -    -    -    -    -    -    -    -    -    -      -    -    -         -     6.8      9.2 11.1 13.0 14.9 16.8 18.7 20.6 22.5 24.4 26.3 28.2 30.1
                                              94   -    -    -    -    -    -    -    -    -    -      -    -    -         -     6.2      8.7 10.6 12.5 14.4 16.3 18.2 20.2 22.1 24.0 25.9 27.8 29.7
                                              95   -    -    -    -    -    -    -    -    -    -      -    -    -         -     5.6      8.1 10.0 12.0 13.9 15.8 17.8 19.7 21.6 23.6 25.5 27.4 29.4
                                              96   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   7.5   9.5 11.4 13.4 15.3 17.3 19.2 21.2 23.2 25.1 27.1 29.0
                                              97   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   7.0   8.9 10.9 12.9 14.9 16.8 18.8 20.8 22.7 24.7 26.7 28.7
   Condenser Air Dry-Bulb Temperature (°F)
                                              98   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   6.4   8.4 10.4 12.4 14.4 16.4 18.3 20.3 22.3 24.3 26.3 28.3
                                              99   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   5.8   7.9   9.9 11.9 13.9 15.9 17.9 19.9 21.9 24.0 26.0 28.0
                                             100   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   5.3   7.3   9.3 11.4 13.4 15.4 17.5 19.5 21.5 23.6 25.6 27.7
                                             101   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     6.8   8.8 10.9 12.9 15.0 17.0 19.1 21.1 23.2 25.3 27.3
                                             102   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     6.2   8.3 10.4 12.4 14.5 16.6 18.6 20.7 22.8 24.9 27.0
                                             103   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     5.7   7.8   9.9 11.9 14.0 16.1 18.2 20.3 22.4 24.5 26.7
                                             104   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     5.2   7.2   9.3 11.5 13.6 15.7 17.8 19.9 22.1 24.2 26.3
                                             105   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     6.7   8.8 11.0 13.1 15.2 17.4 19.5 21.7 23.8 26.0
                                             106   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     6.2   8.3 10.5 12.6 14.8 17.0 19.1 21.3 23.5 25.7
                                             107   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     5.7   7.9 10.0 12.2 14.4 16.6 18.7 21.0 23.2 25.4
                                             108   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     5.2   7.4   9.5 11.7 13.9 16.1 18.4 20.6 22.8 25.1
                                             109   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     -     6.9   9.1 11.3 13.5 15.7 18.0 20.2 22.5 24.7
                                             110   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     -     6.4   8.6 10.8 13.1 15.3 17.6 19.9 22.1 24.4
                                             111   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     -     5.9   8.1 10.4 12.6 14.9 17.2 19.5 21.8 24.1
                                             112   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     -     5.4   7.6   9.9 12.2 14.5 16.8 19.1 21.5 23.8
                                             )
                                             113   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     -     -     7.2   9.5 11.8 14.1 16.4 18.8 21.1 23.5
                                             114   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     -     -     6.7   9.0 11.4 13.7 16.1 18.4 20.8 23.2
                                             115   -    -    -    -    -    -    -    -    -    -      -    -    -         -          -   -     -     -     -     6.2   8.6 10.9 13.3 15.7 18.1 20.5 22.9
                                             (T
```

## Charging reference B: target evaporator temperature split

- Table RD-3 (Target Temperature Split, return dry-bulb minus supply dry-bulb), same ACM appendix and same hosting caveat.
- Axes: columns are return-air wet-bulb (F); rows are return-air dry-bulb (F). Relative humidity is not an axis. Convert RH to wet-bulb before use.
- Airflow assumption: 400 cfm per 12,000 Btu/h (0.033 cfm/Btu, DOE A test conditions), section RD.2.6. This is 400 cfm per nominal ton (12,000 Btu/h), not a humidity-dependent figure.
- Procedure (RD.2.6): actual split = return dry-bulb minus supply dry-bulb; target from RD-3 at return wet-bulb and return dry-bulb. A dash means the measurements are probably in error; re-measure.
- Cross-check: Proctor Engineering's "Temperature Split / Airflow Check Procedure" (proctoreng.com/dnld/Temp_airflow.pdf) reproduces the same grid, adapted from Carrier, CheckMe! and Title 24. Its pass band is plus or minus 3 F. Rows 70 to 72 match RD-3 where both are visible. The Proctor text layer is partial, so RD-3 is the transcription used here. Proctor's sheet does not state its airflow basis in the extracted text (OPEN).
- Verbatim text-layer copy of Table RD-3. In this copy the rows run from 70 to 84 F return dry-bulb, and the text layer has no further rows. Dashes mean no target.

```text
Table RD-3: Target Temperature Split (Return Dry-Bulb – Supply Dry-Bulb)
                                                                                                   Return Air Wet-Bulb (ºF) (T return, wb)
                                                 50   51   52   53   54   55   56   57   58   59     60     61    62    63    64    65       66   67   68   69   70   71   72    73    74    75    76
                                            70   20.9 20.7 20.6 20.4 20.1 19.9 19.5 19.1 18.7 18.2 17.7 17.2 16.5 15.9 15.2 14.4 13.7 12.8 11.9 11.0 10.0 9.0              7.9   6.8   5.7   4.5   3.2
                                            71   21.4 21.3 21.1 20.9 20.7 20.4 20.1 19.7 19.3 18.8 18.3 17.7 17.1 16.4 15.7 15.0 14.2 13.4 12.5 11.5 10.6 9.5              8.5   7.4   6.2   5.0   3.8
                                            72   21.9 21.8 21.7 21.5 21.2 20.9 20.6 20.2 19.8 19.3 18.8 18.2 17.6 17.0 16.3 15.5 14.7 13.9 13.0 12.1 11.1 10.1 9.0               7.9   6.8   5.6   4.3
  Return Air Dry–Bulb (ºF) (T return, db)
                                            73   22.5 22.4 22.2 22.0 21.8 21.5 21.2 20.8 20.3 19.9 19.4 18.8 18.2 17.5 16.8 16.1 15.3 14.4 13.6 12.6 11.7 10.6 9.6               8.5   7.3   6.1   4.8
                                            74   23.0 22.9 22.8 22.6 22.3 22.0 21.7 21.3 20.9 20.4 19.9 19.3 18.7 18.1 17.4 16.6 15.8 15.0 14.1 13.2 12.2 11.2 10.1 9.0                7.8   6.6   5.4
                                            75   23.6 23.5 23.3 23.1 22.9 22.6 22.2 21.9 21.4 21.0 20.4 19.9 19.3 18.6 17.9 17.2 16.4 15.5 14.7 13.7 12.7 11.7 10.7 9.5                8.4   7.2   5.9
                                            76   24.1 24.0 23.9 23.7 23.4 23.1 22.8 22.4 22.0 21.5 21.0 20.4 19.8 19.2 18.5 17.7 16.9 16.1 15.2 14.3 13.3 12.3 11.2 10.1 8.9                 7.7   6.5
                                            77    -   24.6 24.4 24.2 24.0 23.7 23.3 22.9 22.5 22.0 21.5 21.0 20.4 19.7 19.0 18.3 17.5 16.6 15.7 14.8 13.8 12.8 11.7 10.6 9.5                 8.3   7.0
                                            78    -    -    -   24.7 24.5 24.2 23.9 23.5 23.1 22.6 22.1 21.5 20.9 20.2 19.5 18.8 18.0 17.2 16.3 15.4 14.4 13.4 12.3 11.2 10.0 8.8                  7.6
                                            79    -    -    -    -    -   24.8 24.4 24.0 23.6 23.1 22.6 22.1 21.4 20.8 20.1 19.3 18.5 17.7 16.8 15.9 14.9 13.9 12.8 11.7 10.6 9.4                  8.1
                                            80    -    -    -    -    -    -   25.0 24.6 24.2 23.7 23.2 22.6 22.0 21.3 20.6 19.9 19.1 18.3 17.4 16.4 15.5 14.4 13.4 12.3 11.1 9.9                  8.7
                                            81    -    -    -    -    -    -    -   25.1 24.7 24.2 23.7 23.1 22.5 21.9 21.2 20.4 19.6 18.8 17.9 17.0 16.0 15.0 13.9 12.8 11.7 10.4 9.2
                                            82    -    -    -    -    -    -    -    -   25.2 24.8 24.2 23.7 23.1 22.4 21.7 21.0 20.2 19.3 18.5 17.5 16.6 15.5 14.5 13.4 12.2 11.0 9.7
                                            83    -    -    -    -    -    -    -    -    -   25.3 24.8 24.2 23.6 23.0 22.3 21.5 20.7 19.9 19.0 18.1 17.1 16.1 15.0 13.9 12.7 11.5 10.3
                                            84    -    -    -    -    -    -    -    -    -   25.9 25.3 24.8 24.2 23.5 22.8 22.1 21.3 20.4 19.5 18.6 17.6 16.6 15.6 14.4 13.3 12.1 10.8
```

## Source list

Charts read (text layer, fetched in memory):
1. Arkema Forane Ref PT Regular Chart EN (R-454B, R-513A): https://forane.arkema.com/files/live/sites/shared_arkema/files/downloads/fluorochemicals/Forane%20Ref%20PT%20Regular%20Chart%20EN
2. Arkema Forane 407A saturation P-T data: https://www.Arkema.com/files/live/sites/shared_arkema/files/downloads/fluorochemicals/forane-407a-pressuretemperature-chart.pdf
3. Arkema Forane 407C saturation P-T data: https://www.Arkema.com/files/live/sites/shared_arkema/files/downloads/fluorochemicals/forane-407c-pressure-temperature-chart.pdf
4. Arkema Forane 404A saturation P-T data: https://www.Arkema.com/files/live/sites/shared_arkema/files/downloads/fluorochemicals/forane-404a-pressure-temperature-chart.pdf
5. Arkema Forane 410A saturation P-T data: https://www.Arkema.com/files/live/sites/shared_arkema/files/downloads/fluorochemicals/forane-410a-pressure-temperature-chart.pdf
6. A-Gas R-422D technical information (file r422d): https://www.agas.com/media/ll0nb212/r422d-technical-information.pdf
7. Hudson Technologies R-448A PT chart: https://www.hudsontech.com/pdfs/pt-charts/R-448A-Pressure-Temperature-Chart.pdf
8. Hudson Technologies R-449A PT chart: https://www.hudsontech.com/pdfs/pt-charts/R-449A-Pressure-Temperature-Chart.pdf
9. Hudson Technologies R-452A PT chart: https://www.hudsontech.com/pdfs/pt-charts/R-452A-Pressure-Temperature-Chart.pdf
10. Hudson Technologies R-407F PT chart (single column): https://www.hudsontech.com/pdfs/pt-charts/R-407F-Pressure-Temperature-Chart.pdf
11. Hudson Technologies R-410A PT chart (single column): https://www.hudsontech.com/pdfs/pt-charts/R-410A-Pressure-Temperature-Chart.pdf
12. Hudson Technologies R-404A PT chart (single column): https://www.hudsontech.com/pdfs/pt-charts/R-404A-Pressure-Temperature-Chart.pdf
13. Hudson Technologies R-454B PT chart (single column): https://www.hudsontech.com/pdfs/pt-charts/R-454B-Pressure-Temperature-Chart.pdf
14. Hudson Technologies R-32 PT chart (single column): https://hudsontech.com/pdfs/pt-charts/R-32-Pressure-Temperature-Chart.pdf
15. Hudson Technologies R-513A PT chart (single column): https://www.hudsontech.com/pdfs/pt-charts/R-513A-Pressure-Temperature-Chart.pdf
16. Hudson Technologies R-422D PT chart: https://www.hudsontech.com/pdfs/pt-charts/R-422D-Pressure-Temperature-Chart.pdf
17. Chadwell Supply A2L PT chart, USA, F/psig (publisher not shown in the file; column order inferred): https://www.chadwellsupply.com/globalassets/articles-pk/a2l/a2lptc-usa_04-24.pdf
18. Solstice N40 / Genetron R448A PT chart copy, psig-to-temperature form (rsd.net): https://www.rsd.net/fx/pdf/suite/genetron_hfo_blends/Genetron_R448A_N40_PT_chart.pdf
19. Honeywell R-448A PT chart copy, psig-to-temperature form, header only (meiersupply): https://meiersupply.com/customer/docs/skudocs/Document_Links/Vendors/Chemours/R-448A/R-448APTCHART.pdf

Charging references:
20. CEC Residential ACM Manual Appendix RD-2005 (Tables RD-2 and RD-3, hosted by Tru-Tech Tools): https://trutechtools.com/content/brands/trutechtools/documents/non-txv-charging-guide.pdf
21. Proctor Engineering, Temperature Split / Airflow Check Procedure (partial cross-check): https://www.proctoreng.com/dnld/Temp_airflow.pdf

Reached but not read as charts:
22. Honeywell Solstice 454B PT chart, returned HTML: https://advancedmaterials.honeywell.com/content/dam/advancedmaterials/en/documents/document-lists/fluorine-products/technical/hon-ess-am-3161690-adm-tds-pt-chart-solstice-454b-ltr-en.pdf
23. Arkema Forane 2022 regular chart at forane.com, returned HTML: https://www.forane.com/files/live/sites/shared_arkema/files/downloads/fluorochemicals/2022%20Forane%20Ref%20PT%20Regular%20Chart%20lr.pdf
24. DuPont/Suva 407A guide (search lead only): https://wizard.youngsupply.com/files/350-11503.pdf
25. Chemours Opteon XP40 datasheet copy, R-449A (search lead only): https://meiersupply.com/customer/docs/skudocs/Document_Links/Vendors/Chemours/R-449A/R-449ADATASHEET.pdf
26. Chemours Opteon XP10 TEMPCHART copy, R-513A (search lead only): https://meiersupply.com/customer/docs/skudocs/Document_Links/Vendors/Chemours/R-513A/R-513ATEMPCHART.pdf

## OPEN

- Manufacturer piston or fixed-orifice superheat table (Carrier, Bryant, Goodman, Rheem, Trane, Lennox): not found. The CEC RD-2 table is the substitute in hand.
- R-407F liquid and vapor split from a second source.
- R-452A second source and a Chemours Opteon XP44 chart.
- R-449A Chemours XP40 datasheet copy (item 25): not parsed.
- R-513A Chemours TEMPCHART copy (item 26): temperature form, not parsed.
- R-448A and R-454B psig-at-temperature charts from Honeywell itself: not reached (items 18, 19, 22).
- R-407A DuPont/Suva guide (item 24): not read.
- Hudson R-407A and R-407C copies: not read.
- Visual check of every PDF value against the rendered page: not done. All values are from the text layer.
- CEC table hosted by Tru-Tech Tools, not checked against the CEC original.
- Proctor sheet airflow basis: not stated in the extracted text.
- Justia patent tables (US 8,583,384 and US 9,207,007) in the search results: not read, and not primary sources.
