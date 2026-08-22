# Piano — Restyling variante "solid" + sessioni corte

> **Modalità piano:** nessuna esecuzione; solo analisi e piano. Branch: `restyle/blocks`.

**Goal:** rendere la variante **solid** leggibile e ben delimitata (i 4 problemi segnalati) e unire le doppie qualifiche MotoGP/Moto2/Moto3 in un unico blocco.

## Problemi → cause (verificate nel codice)

| # | Problema | Causa (file:righe) |
|---|---|---|
| 1 | Nome serie poco leggibile su solid | header con testo bianco su colori chiari (`#FFD400` IndyCar, `#94A3B8` IMSA, `#84CC16` Moto3…) — `session-block.tsx:386-393` usa sempre `color:#fff` |
| 2 | Corpo blocco = sfondo calendario, bordo non visibile | corpo usa `var(--panel)` + ring `1px var(--border)` (troppo tenue, uguale alle card attorno) — `session-block.tsx:379-381` |
| 3 | Hover quadrato su forma stonata | `.session-block:hover` in `globals.css:89-93` applica `box-shadow` rettangolare sull'intero `<button>` mentre i corpi interni hanno `rounded-md/lg`; il button non ha border-radius proprio |
| 4 | TBC/orario tagliato nelle sessioni corte | micro (<50px): TimeRow mostra solo start; compact (<68px) mostra tutto ma con gap fissi — con l'header solid che occupa ~16px resta troppo poco |
| 5 | Q1+Q2 MotoGP separati da buco 10' (15'+15') | dati reali in `motogp-schedule.json` ("Qualifying Nr. 1" 10:50-11:05, "Nr. 2" 11:15-11:30); merge in `scripts/merge-motogp.ts:195-247` crea una Session per riga |

## Task

### Task 1 — Leggibilità header solid (contrasto adattivo)
**File:** `src/components/session-block.tsx` (SolidBody)

Calcolare la luminanza di `--sc` e scegliere testo nero/bianco. Aggiungere helper:

```ts
function headerTextColor(bgVar: string): string {
  // color-mix non risolvibile sincronamente → usare series.color già disponibile
}
```

In pratica: `SessionBlock` passa già `series.color` via CSS var. Soluzione minima: mappa `SERIES_LIGHT_BG = new Set(["indycar","imsa","moto3","moto2"])` → quelle usano `color:#111`. In alternativa (più robusta): leggere il colore hex da `SERIES_BY_ID[session.series].color`, calcolare luminanza YIQ e decidere `#fff` vs `#141414`.

**Scelto:** YIQ su hex da `SERIES_BY_ID` (nessuna lista manuale da mantenere).

### Task 2 — Delimitazione corpo solid
**File:** `src/components/session-block.tsx` (SolidBody)

- Sfondo corpo: `var(--panel)` → leggera tinta serie: `color-mix(in srgb, var(--sc) 7%, var(--panel))`
- Ring: `1px var(--border)` → `inset 0 0 0 1px color-mix(in srgb, var(--sc-text) 30%, transparent)`

Il blocco si stacca dallo sfondo senza diventare un "tint".

### Task 3 — Hover rotondo
**File:** `globals.css` (righe 88-93) + eventualmente `session-block.tsx:71`

Aggiungere al `<button>` `rounded-md` e spostare l'hover-ring dentro lo stesso raggio:

```css
.session-block { border-radius: 6px; }
.session-block:hover {
  box-shadow:
    inset 0 0 0 2px var(--sc-text),
    0 0 0 2px color-mix(in srgb, var(--sc-text) 30%, transparent) !important;
}
```

Il button ora è rotondo quanto i corpi → hover coerente.

### Task 4 — Sessioni corte: gerarchia informativa
**File:** `session-block.tsx` (SolidBody, sezioni micro/compact)

- Header solid: in micro nasconde il tipo, tiene solo badge serie (già truncate-safe)
- micro: start ORIZZONTALE accanto al badge serie (stessa riga, come AccentBody.micro) invece di riga dedicata → niente tagli
- Verifica con sessioni reali da 15' (Q1/Q2 prima del merge) e 10' (Warm Up)

### Task 5 — Unione Qualifying Nr.1 + Nr.2 (MotoGP/Moto2/Moto3)
**File:** `scripts/merge-motogp.ts`

Dopo la raccolta delle sessioni di un giorno/categoria, fondere le coppie di qualifying consecutivi:

```ts
// dentro il loop day.sessions, pre-raccogliere per categoria,
// poi: se due "Qualifying Nr. N" consecutivi (gap ≤ 30min) → UNA Session:
//   name: "Qualifying", startUtc = Q1.start, endUtc = Q2.end
//   isEstimatedStart/isEstimatedEnd restano false (orari reali estremi)
```

Nota: `classifySessionType("Qualifying")` → `qualifying` (badge "QUALI"). Il gap 10' rientra nel blocco unito — accettabile e desiderato dall'utente.
Esecuzione: `npx tsx scripts/merge-motogp.ts` rigenera `calendar-2026.json` → commit dei dati.

⚠️ Il merge tocca SOLO MotoGP/Moto2/Moto3. Altre serie restano con sessioni corte gestite dal Task 4.

### Task 6 — Verifica + deploy
- `npx tsc --noEmit`
- `npm run dev` → controllo visivo: week view con weekend MotoGP (Q unite), F1 solid, hover rotondo, sessioni 10-15'
- commit, push, `gh workflow run update.yml --ref restyle/blocks -f deploy_only=true`
- verifica bundle online (marker `f1_academy:"accent"` o nuovo marker)

## Rischi / note
- L'hover ring `!important` esiste già: manterremo la stessa tecnica (inline style vince altrimenti).
- YIQ richiede hex: i colori in `series.ts` sono tutti hex a 6 cifre ✓.
- Il pill resta finché non scegliamo la variante finale; il fix solid vale anche per il futuro default.
