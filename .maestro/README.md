# Maestro E2E-Tests

## Einmalige Installation

### 1. Java 11+ installieren
Maestro benötigt **Java 11 oder höher**. Du hast aktuell Java 8.

Empfehlung: [Adoptium Temurin 21](https://adoptium.net/) (LTS) herunterladen und installieren.
Nach Installation im Terminal prüfen: `java -version` → muss `17` oder `21` ausgeben.

### 2. Maestro CLI installieren (Windows)

```powershell
iex "& { $(iwr -useb https://get.maestro.mobile.dev/windows) }"
```

Danach Terminal neu starten und prüfen: `maestro --version`

### 3. Android-Gerät/Emulator vorbereiten
- **Emulator**: Android Studio → AVD Manager → Gerät starten
- **Echtes Gerät**: USB-Debugging aktivieren, per USB verbinden

### 4. Credentials einrichten
```powershell
Copy-Item .maestro\.env.example .maestro\.env
# Dann .maestro\.env mit echten Werten befüllen (Texteditor)
```

Verwende einen **Kunden-Testaccount** (kein Admin), damit Buchungsregeln greifen.

---

## Tests ausführen

### App starten
```powershell
npx expo start --android
```
Warte bis die App auf dem Gerät/Emulator läuft.

### Alle Flows ausführen
```powershell
npm run e2e
```

### Einzelnen Flow ausführen
```powershell
npm run e2e:single .maestro/flows/01_login_erfolgreich.yaml
```

### Mit eigener APP_ID (z.B. Expo Go)
```powershell
maestro test .maestro/flows --env APP_ID=host.exp.exponent --env TEST_EMAIL=... --env TEST_PASSWORD=...
```

---

## Flows im Überblick

| Datei | Was wird getestet |
|-------|-------------------|
| `01_login_erfolgreich.yaml` | Login mit korrekten Daten, Bottom-Nav sichtbar |
| `02_login_fehlermeldung.yaml` | Falsches Passwort → Fehlermeldung, kein Weiterleiten |
| `03_navigation.yaml` | Alle 5 Tabs erreichbar |
| `04_home_screen.yaml` | Home-Inhalte nach Login sichtbar |
| `05_profil.yaml` | Profil-Sektionen, Passwort-Ändern-Dialog |
| `06_logout.yaml` | Abmelden führt zurück zum Login-Screen |
| `07_termin_stornieren.yaml` | Stornieren eines Termins (braucht existierenden Termin im Testaccount) |

`_login.yaml` ist ein wiederverwendbarer Hilfs-Flow (kein eigener Test).

---

## APP_ID wählen

| Szenario | APP_ID |
|----------|--------|
| Entwicklungs-Build (`expo run:android`) | `de.pkfussballschule.app` |
| Expo Go | `host.exp.exponent` |

---

## Bekannte Einschränkungen

- `07_termin_stornieren.yaml` schlägt fehl wenn der Testaccount keinen zukünftigen Termin hat. Termin vorher im Admin anlegen.
- Animationen können auf langsamen Emulatoren zum Timeout führen. `waitForAnimationToEnd` verlängern oder Animations-Geschwindigkeit im Emulator auf "0.5x" setzen.
- Maestro läuft nicht auf iOS-Simulator unter Windows (kein Xcode). Für iOS: Mac oder CI (GitHub Actions + macOS-Runner).
