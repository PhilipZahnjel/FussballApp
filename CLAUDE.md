# TermineApp – Claude Kontext

## Projekt
EMS-Studio Buchungs-App. Kunden buchen Trainingstermine, Betreiber verwalten diese.

**Stack:** React Native · Expo · TypeScript · Supabase (PostgreSQL + Auth + Edge Functions)  
**Plattformen:** iOS, Android, Web (Admin-UI primär Web/PC)  
**Repo:** PhilipZahnjel/TermineApp — nach jeder Änderung committen und pushen.  
**Supabase-Projekt:** `gajwglshmkcoznhqvvpg` (EU Central)

---

## Rollen & Zugriff

Zwei Rollen in `profiles.role`:
- `'admin'` → sieht Admin-Dashboard (PC/Web-Layout, Sidebar-Navigation)
- `'customer'` → sieht Kunden-App (Mobile-Layout, Bottom-Navigation)

**Login-Flow:** Nach Login wird `profiles.role` abgefragt. Admin → `AdminApp`, Kunde → normale App. Während Rollenabfrage läuft: Ladekreis.

**Wichtig:** Admin-UI wird im Vollbild gerendert (kein 430px-Container). Kunden-App ist auf 430px begrenzt (Mobile-Feel im Browser).

**Admin-Account:** `philip@zahnjel.de`

---

## Datenbankstruktur

```
profiles: {
  id, full_name, email, phone, birth_date, address,
  customer_number (int, auto-increment ab 101),
  is_active (bool),
  role ('admin'|'customer'),
  iban, bic, account_holder, bank_name,
  mandate_reference, mandate_date (für SEPA)
}

appointments: {
  id, user_id, date (YYYY-MM-DD), time (HH:MM),
  status ('confirmed'|'cancelled'), program, created_at
}

measurements: { id, user_id, measured_at, weight, height, ... }

charges: {
  id, user_id, amount, description, period (YYYY-MM),
  status ('pending'|'collected'|'failed'),
  created_at, collected_at
}
```

**RLS:** `is_admin()` Funktion (SECURITY DEFINER) prüft Rolle ohne Rekursion.  
Admins dürfen alle Zeilen lesen/schreiben. Kunden nur eigene.

---

## Buchungsregeln (kritisch — gilt für Kunden UND Admin)
- Max. **1 bestätigter Termin pro Tag** pro Nutzer.
- **Ausnahme:** Lymphdrainage (`program: 'lymph'`) darf zusätzlich gebucht werden.
- Prüfung: client-seitig (State) **und** server-seitig (Supabase Query).
- Wochenenden (Sa + So) und deutsche Bundesfeiertage nicht buchbar.
- Max. **2 Personen pro Slot**.

---

## Programme & Farben
| ID | Name | Farbe |
|---|---|---|
| `muscle` | EMS-Intensiv Muskelaufbau | `#4A8FE8` (Blau) |
| `lymph` | Lymphdrainage | `#3DBFA0` (Türkis) |
| `relax` | Relax | `#F5A84A` (Orange) |
| `metabolism` | Stoffwechsel | `#E87676` (Koralle) |

---

## Admin-UI (`src/admin/`)

**Screens:**
- `DashboardScreen` — Statistiken, nächste Termine aller Kunden
- `KundenScreen` — Suchfeld + Kundenliste, "Neuen Kunden anlegen"-Formular
- `KundenDetailScreen` — Profil, Bankverbindung bearbeiten, SEPA-Mandat, Termine buchen/stornieren
- `TerminkalenderScreen` — Wochenansicht aller Termine
- `FinanzenScreen` — SEPA pain.008 XML-Export

**Hook:** `useAdminData` in `src/admin/hooks/useAdminData.ts`  
Funktionen: `cancelAppointment`, `addAppointmentForCustomer`, `saveMandate`, `saveBankDetails`, `addCharge`, `createCustomer`

**SEPA-Util:** `src/admin/utils/sepa.ts` — generiert pain.008.003.02 XML, `downloadXml()` für Browser-Download.

---

## Kundenerstellung (Edge Function)
**Funktion:** `create-customer` (Supabase Edge Function, `verify_jwt: false`)  
**Ablauf:** Admin füllt Formular → Edge Function erstellt Auth-User mit temporärem Passwort → Profil wird angelegt → Passwort wird **inline in der UI angezeigt** (kein E-Mail-Versand, kein `Alert.alert()`).  
**Grund kein E-Mail:** Supabase Free Tier hat unzuverlässigen E-Mail-Versand.  
**Aufruf:** `supabase.functions.invoke('create-customer', { body: params })`

---

## Hooks & State (Kunden-App)
- `useAppointments` → `appointments` (alle, für Kapazität) + `myAppointments` (nur eigene, für UI)
- `useProfile` → Profil inkl. `role`
- `TermineScreen` bekommt `myAppointments` (nicht `appointments`!)
- `BuchenScreen` bekommt beide

---

## UI-Regeln
- **Kein `Alert.alert()` für Web** — stattdessen inline UI-Komponenten (State + JSX)
- Kein Hover-Effekt in Kalender-Komponenten (Touch-Bugs auf Mobile)
- Vergangene Termine werden ausgegraut (`opacity: 0.5`, grauer Balken) — unabhängig von `status`
- Admin-Farben: Sidebar `#1C2133`, Hintergrund `#F4F6F9`, Akzent `#5A8C6A`
- Kunden-Farben: Gradient `C.bgTop → C.bgBot`, Akzent `#5A8C6A`

---

## Bekannte Fallstricke
- Demo-User **nie per SQL in `auth.users` anlegen** — fehlende Pflichtfelder (`instance_id`, `confirmation_token = ''`) brechen den Login
- Edge Functions die selbst Auth prüfen: `verify_jwt: false` setzen
- `supabase.functions.invoke()` verwenden, nie manuelles `fetch()` mit konstruierter URL
- Admin-Layout muss aus dem 430px-Container heraus — eigener Render-Pfad in `App.tsx` vor `appContent`
