# Isolamento sessioni: fix eventKey per GP, Hyperpole

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Quando l'utente seleziona (click) una sessione, tutte le sessioni dello stesso weekend devono rimanere visibili e il resto deve opacizzarsi. Al momento sessioni come "GP" (MotoGP) e "Hyperpole" (WEC) hanno eventKey diversi dal resto dello stesso weekend e quindi vengono isolate erroneamente.

**Architecture:** L'isolamento raggruppa sessioni per `series:eventKey`. L'`eventKey` è generato da `buildEventKey()` che estrae il nome base della sessione togliendo parole-chiave come "Free Practice", "Sprint Race", ecc. Manca "GP" e "Hyperpole" nell'elenco, quindi queste sessioni generano chiavi diverse dal resto del weekend.

**Tech Stack:** TypeScript, Node.js (per lo script di re-keying)

---

## Task 1: Aggiungere "GP" e "Hyperpole" a SESSION_KEYWORDS

**Obiettivo:** Aggiungere i due keyword mancanti a `SESSION_KEYWORDS` in `thesportsdb.ts`, nell'ordine corretto per non cannibalizzare keyword più specifiche.

### Step 1: Modificare l'array

**File:** `src/lib/sources/thesportsdb.ts:123-146`

Inserire "GP" DOPO "Race" (perché "Race" è più specifico e matcha prima) e "Hyperpole" dopo "Feature Race" (posizione arbitraria, non confligge con nessun altro keyword):

```typescript
const SESSION_KEYWORDS = [
  "Free Practice",
  "Practice 1",
  "Practice 2",
  "Practice 3",
  "Practice 4",
  "Practice",
  "Sprint Qualifying",
  "Sprint Shootout",
  "Sprint Race",
  "Sprint",
  "Feature Race",
  "Hyperpole",         // <-- NUOVO
  "Qualifying",
  "Quali",
  "Warm-up",
  "Warm Up",
  "Warmup",
  "Race",
  "GP",                // <-- NUOVO (dopo "Race" per sicurezza)
  "Testing",
  "Test",
  "Shakedown",
  "Reconnaissance",
  "Drivers Parade",
];
```

**Perché "GP" dopo "Race":** "Race" è una parola più specifica e matcha prima in sessioni come "Sprint Race" (già gestita dal keyword "Sprint Race" a riga 132) o "Feature Race". "GP" è breve e va alla fine per non interferire.

### Step 2: Verifica con TypeScript

```bash
npx tsc --noEmit
```
Expected: 0 errori (nessuna dipendenza rotta — l'array è solo dati).

---

## Task 2: Script per ri-generare eventKey nel JSON

**Obiettivo:** Ricalcolare `eventKey` per tutte le sessioni nel JSON esistente usando la nuova `buildEventKey()`. Le sessioni FIA (F2/F3) hanno `eventKey` generato dal nome del circuito in `fia.ts` e non verranno toccate.

### Step 1: Creare script

**Crea:** `scripts/rekey-events.ts`

```typescript
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEventKey } from "../src/lib/sources/thesportsdb";
import type { CalendarData } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

function main(): void {
  const inPath = join(DATA_DIR, "calendar-2026.json");
  const raw = readFileSync(inPath, "utf8");
  const data: CalendarData = JSON.parse(raw);

  let changed = 0;
  const updated = data.sessions.map((s) => {
    const newKey = buildEventKey(s.name);
    if (newKey !== s.eventKey) {
      changed++;
      return { ...s, eventKey: newKey };
    }
    return s;
  });

  const payload: CalendarData = { ...data, sessions: updated };
  const outPath = join(DATA_DIR, "calendar-2026.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  process.stdout.write(`Re-keyed ${changed} sessions.\n`);
}

main();
```

### Step 2: Eseguire

```bash
npx tsx scripts/rekey-events.ts
```

Expected output: `Re-keyed N sessions.` (N dovrebbe essere il numero di sessioni TheSportsDB con eventKey diverso, non FIA).

---

## Task 3: Verifica risultato

**Obiettivo:** Controllare che le eventKey ora siano coerenti per weekend.

### Verifica eventKey MotoGP

```bash
npx tsx -e "
const d = require('./data/calendar-2026.json');
const motogp = d.sessions.filter(s => s.series === 'motogp' && (s.eventKey === 'germany' || s.eventKey === 'germany_gp'));
motogp.forEach(s => console.log(s.eventKey, s.name));
"
```

Expected: tutte le sessioni del weekend tedesco ora usano `germany` (invece di `germany` + `germany_gp` separati).

### Verifica eventKey Hyperpole

```bash
npx tsx -e "
const d = require('./data/calendar-2026.json');
const hyp = d.sessions.filter(s => s.name.toLowerCase().includes('hyperpole'));
hyp.forEach(s => console.log(s.eventKey, s.name));
"
```

Expected: "6 Hours of São Paulo Hyperpole - LMGT3" ora ha eventKey `6_hours_of_são_paulo` (invece di `..._hyperpole_-_lmgt3`).

### Verifica che FIA (F2/F3) sia invariato

```bash
npx tsx -e "
const d = require('./data/calendar-2026.json');
const f2 = d.sessions.filter(s => s.series === 'f2' && s.eventKey === 'silverstone');
const f3 = d.sessions.filter(s => s.series === 'f3' && s.eventKey === 'silverstone');
console.log('F2 Silverstone:', f2.length, 'sessions');
console.log('F3 Silverstone:', f3.length, 'sessions');
"
```

Expected: 4 F2 + 4 F3 sessioni con eventKey `silverstone` (invariato, generato da `fia.ts`).

---

## Rischi e note

- **"GP" è corto e potrebbe matchare accidentalmente.** Sessioni come "GP2 Series" (se mai esistessero) o nomi di circuiti che contengono "GP" sarebbero troncati. Nel dataset attuale questo non succede perché:
  - "GP" è solo nei nomi MotoGP (es. "Aragón GP", "Germany GP")
  - I nomi F1 usano "Grand Prix", non "GP"
  - `idx > 0` nel check protegge da sessioni che iniziano con "GP"
- **"Hyperpole"** non confligge con nessun altro keyword.
- **Nessuna modifica a `fia.ts`** — F2/F3 usano già eventKey basati sul circuito, funzionano correttamente.

## Files che cambiano

| File | Modifica |
|------|----------|
| `src/lib/sources/thesportsdb.ts:123-146` | Aggiunge "GP" e "Hyperpole" a `SESSION_KEYWORDS` |
| `scripts/rekey-events.ts` | Nuovo script per ricalcolare eventKey nel JSON |
| `data/calendar-2026.json` | Aggiornato dallo script (eventKey corretti) |
