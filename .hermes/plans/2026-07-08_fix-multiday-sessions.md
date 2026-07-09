# Sessioni multi-giorno: fix posizionamento oltre mezzanotte

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Correggere il rendering delle sessioni che attraversano la mezzanotte (es. gara WEC di 6 ore che inizia domenica sera e termina lunedì mattina).

**Architecture:** Il bug è in `getSessionPosition()` in `src/lib/timezone.ts`: calcola `endMin` come `min(1440, startMin + durationMin)` usando la durata piena, invece di calcolarlo dalla differenza tra `endUtc` reale e inizio del giorno. Le sessioni multi-giorno vengono così mostrate con un'altezza errata (eccessiva) sul secondo giorno.

**Tech Stack:** TypeScript, React 19, Next.js 16.2.9

---

## Task 1: Fix `getSessionPosition()` — usa `endUtc` reale invece di `startMin + duration`

### Obiettivo
Rendere `getSessionPosition` consapevole di dove la sessione finisce realmente nel giorno mostrato, invece di usare `startMin + durationMin`.

### Step 1: Aggiungi parametro `endUtc` a `getSessionPosition`

**File da modificare:** `src/lib/timezone.ts:218-248`

Sostituisci la firma e il calcolo di `endMin`:

```typescript
export function getSessionPosition(
  sessionStartUtc: string,
  sessionEndUtc: string,
  dayStartIsoStr: string,
  hourInfos: HourInfo[],
): { top: number; height: number } {
  const startMs = Date.parse(dayStartIsoStr);
  const startMin = Math.max(0, (Date.parse(sessionStartUtc) - startMs) / 60_000);
  const displayDuration = Math.max(
    (Date.parse(sessionEndUtc) - Date.parse(sessionStartUtc)) / 60_000,
    60,
  );
  // Clip endMin to the actual session end within the day, or startMin + displayDuration
  const actualEndMin = (Date.parse(sessionEndUtc) - startMs) / 60_000;
  const endMin = Math.min(1440, Math.max(startMin, actualEndMin));
  // ...rest unchanged
```

**Importante:** `displayDuration` ora usa la durata reale (`sessionEndUtc - sessionStartUtc`) invece di `durationMin` letto dal JSON. Il clamp `>= 60` resta per garantire visibilità.

### Step 2: Aggiorna i chiamanti

**File da modificare:**
- `src/components/session-block.tsx:~28-33`
- `src/lib/timezone.ts:~175` (`computeDayHourHasEvents` – solo lettura, non serve modificarlo)

In `SessionBlock.tsx`, riga 28:
```typescript
const { top, height } = getSessionPosition(
  session.startUtc,
  session.endUtc,   // <-- AGGIUNTO: passa anche endUtc
  dayStartIso,
  hourInfos,
);
```

### Step 3: Compila e verifica

Run:
```bash
npx tsc --noEmit
```
Expected: 0 errori.

---

## Task 2: Verifica su sessioni reali che attraversano la mezzanotte

### Obiettivo
Assicurarsi che una sessione che inizia domenica sera e finisce lunedì mattina venga renderizzata correttamente in entrambi i giorni.

### Step 1: Trova una sessione con attraversamento

Cerca nel JSON sessioni dove `endUtc` è il giorno dopo `startUtc`:

```bash
npx tsx -e "
const d = require('./data/calendar-2026.json');
const cross = d.sessions.filter(s => 
  s.startUtc.slice(0,10) !== s.endUtc.slice(0,10)
);
cross.forEach(s => console.log(
  s.series, s.name, s.startUtc, '->', s.endUtc
));
"
```

### Step 2: Verifica manuale (se non ci sono sessioni reali, creane una di test nel JSON locale)

Se non esistono sessioni multi-giorno, aggiungi temporaneamente un record fittizio nel JSON (non committare) e verifica che:
1. Appaia su entrambi i giorni
2. Altezza e posizione siano corrette (non ecceda l'ora di fine reale del secondo giorno)

---

## Task 3: Verifica che `computeDayHourHasEvents` gestisca correttamente sessioni multi-giorno

### Obiettivo
La funzione `computeDayHourHasEvents` già usa `endUtc` (`s.endUtc`) per calcolare fino a che ora del giorno la sessione è attiva. Deve funzionare già correttamente ma va verificata.

**Verifica:** Leggi `src/lib/timezone.ts:167-188` e conferma che `sEnd = Math.min(1440, (Date.parse(s.endUtc) - startMs) / 60_000)` non usi la durata ma l'endUtc reale — cosa che già fa correttamente ✅.

Nessuna modifica necessaria per questa funzione.

---

## Task 4: Test di integrazione

### Obiettivo
Build completa + test visivo.

```bash
npx eslint src/lib/timezone.ts src/components/session-block.tsx
npx tsc --noEmit
npx next build
```

Expected: 0 errori, build completa, pagine statiche generate.

### Test visivo
1. Apri il sito in locale (`npm run dev`)
2. Vai a una settimana che contiene una sessione multi-giorno (o usa un finto record)
3. Verifica che:
   - Il primo giorno mostri la sessione dalla sua ora di inizio fino a mezzanotte
   - Il secondo giorno mostri la sessione da mezzanotte fino alla sua ora di fine
   - Le altezze corrispondano alla durata effettiva mostrata, non alla durata totale

---

## Rischi e note

- **`displayDuration`** garantisce altezza minima di 60px. Dopo il fix, `displayDuration` deriva da `endUtc - startUtc` (durata reale) non più da `durationMin` del JSON. Per sessioni con `isEstimatedEnd=true`, le due durate dovrebbero coincidere; per sessioni con `isEstimatedEnd=false` (FIA source) la durata reale è più accurata.
- **`endMin = Math.min(1440, Math.max(startMin, actualEndMin))`** — il `Math.max(startMin, ...)` gestisce il caso in cui l'`endUtc` sia prima di `startMin` (non dovrebbe succedere ma meglio prevenire).
- **Nessun cambiamento a `computeDayHourHasEvents`** — già usa `endUtc` direttamente.
- **Nessun cambiamento al data layer** — `durationMin` e `endUtc` rimangono nel JSON, ma il frontend ora usa `endUtc` per il posizionamento.

## Files che cambiano

| File | Tipo modifica |
|------|--------------|
| `src/lib/timezone.ts:218-248` | Modifica firma e logica di `getSessionPosition` |
| `src/components/session-block.tsx:28-33` | Aggiunge parametro `session.endUtc` |
