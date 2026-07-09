# Isolamento sessioni: passa da `series:eventKey` a `series`-only

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Quando l'utente clicca una sessione, tutto ciò che non appartiene alla **stessa serie** viene opacizzato. Niente più matching per `eventKey` — che causava bug con "GP" (MotoGP) e "Hyperpole" (WEC).

**Architecture:** L'isolamento usa `isolatedId` che ora contiene solo il `SeriesId` (es. `"motogp"`) invece di `"series:eventKey"`. Il matching in `SessionBlock` controlla solo `session.series`. Solo 2 righe cambiate.

**Tech Stack:** TypeScript, React 19

---

## Task 1: Cambiare l'isolamento da `series:eventKey` a `series`

### Step 1: Modificare calendar-shell.tsx:106,115

**File:** `src/components/calendar-shell.tsx`

Riga 106 (DayView):
```typescript
onSelectSession={(s, ek) => setIsolatedId(s + ":" + ek)}
```
→
```typescript
onSelectSession={(s) => setIsolatedId(s)}
```

Riga 115 (WeekView):
```typescript
onSelectSession={(s, ek) => setIsolatedId(s + ":" + ek)}
```
→
```typescript
onSelectSession={(s) => setIsolatedId(s)}
```

### Step 2: Modificare session-block.tsx:41

**File:** `src/components/session-block.tsx`

Riga 41:
```typescript
const matches = isIsolated && isolatedId === session.series + ":" + session.eventKey;
```
→
```typescript
const matches = isIsolated && isolatedId === session.series;
```

### Step 3: Verifica

```bash
npx tsc --noEmit
```
Expected: 0 errori.

---

## Task 2: Verifica funzionamento

### Test manuale
1. Avviare il dev server: `npm run dev`
2. Cliccare su una sessione MotoGP Sprint → tutte le MotoGP rimangono visibili, le altre serie si opacizzano
3. Cliccare su una Hyperpole WEC → tutto il WEC rimane visibile, le altre serie si opacizzano
4. Cliccare su spazio vuoto → si resetta l'isolamento

### Test di build
```bash
npx next build
```
Expected: 2 pagine statiche, 0 errori.

---

## Files che cambiano

| File | Riga | Modifica |
|------|------|----------|
| `src/components/calendar-shell.tsx` | 106, 115 | `setIsolatedId(s + ":" + ek)` → `setIsolatedId(s)` |
| `src/components/session-block.tsx` | 41 | `isolatedId === session.series + ":" + session.eventKey` → `isolatedId === session.series` |
