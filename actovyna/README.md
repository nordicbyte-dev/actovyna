<div align="center">

# ◈ ACTOVYNA

### From information to action.

**Een privacybewuste werkruimte die documenten omzet in inzichten, mogelijke deadlines en concrete acties.**

`React` · `TypeScript` · `Vite` · `Python` · `FastAPI` · `SQLAlchemy` · `PostgreSQL / SQLite` · `Docker`

</div>

---

## Wat kan ACTOVYNA nu?

- **Documenten uploaden** — PDF (met selecteerbare tekst), Word (`.docx`), TXT, Markdown en afbeeldingen met optionele OCR.
- **Lokale analyse** — herkent expliciete datums/deadlines en bedragen zonder AI-sleutel, met vindplaats in de brontekst. Lokale samenvatting bestaat uit een tekstfragment, niet uit een door AI geschreven samenvatting.
- **AI-analyse (optioneel)** — alleen nadat je de schakelaar activeert en zelf een API-sleutel toevoegt. Verstuurt maximaal de eerste 15.000 tekens naar OpenAI en gebruikt gestructureerde uitvoer. Bronquotes worden gecontroleerd tegen de tekst.
- **Actiecentrum** — nieuwe acties aanmaken, mogelijke deadlines nalopen, taken afvinken of verwijderen.
- **Dashboard** — live aantallen documenten, openstaande taken, voltooide taken en deadlines binnen zeven dagen.
- **Export & verwijderen** — gegevens downloaden als JSON of verwijderen via de applicatie. Ruwe bestandsbytes worden niet op de server bewaard; geëxtraheerde tekst wel in je database.
- **Responsive interface** — desktop en mobiel.

> **Let op:** Dit is een werkende lokale MVP, geen productieklare dienst voor gevoelige documenten. Er zijn geen accounts, gebruikersisolatie, rate limits of beveiligde internetdeployment. Draai hem op je eigen computer (localhost). Voor echte gebruikers moet eerst authenticatie, autorisatie, encryptiebeleid, back-ups en hostingbeveiliging worden toegevoegd.

## Starten: eenvoudigste manier — Docker Desktop

Vereist: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

1. Download dit project, pak de ZIP uit en open een terminal in de map `actovyna`.
2. Start de app:

   ```bash
   docker compose up --build
   ```

3. Open in je browser: **http://localhost:8080**
4. Stop de app met `Ctrl+C`. De PostgreSQL-data blijven in het Docker-volume opgeslagen.

Voor de AI-optie: kopieer `.env.example` naar `.env`, vul `OPENAI_API_KEY` in en start opnieuw. Maak nooit een API-sleutel openbaar; commit `.env` niet naar GitHub. AI via de OpenAI API kan geld kosten.

Docker bevat Tesseract OCR voor Nederlands en Engels om tekst uit losse afbeeldingen te halen. Gescande PDF's zijn in deze MVP **nog niet OCR-ondersteund**; hiervoor is later een PDF-naar-afbeeldingstap nodig.

## Starten zonder Docker (Windows)

Vereist: Python 3.11+ en Node.js 20.19+ of 22.12+. Gebruik twee terminals.

**Terminal 1 — Python-backend** (vanuit de projectmap):

```powershell
cd backend
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — React-interface**:

```powershell
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Zonder Docker wordt SQLite gebruikt, dus je hoeft geen PostgreSQL te installeren.

**Backend-API bekijken:** http://127.0.0.1:8000/api/docs

AI instellen zonder Docker: maak `backend/.env` met:

```env
OPENAI_API_KEY=jouw_eigen_api_sleutel
OPENAI_MODEL=gpt-4o-mini
```

**OCR zonder Docker:** installeer Tesseract OCR apart op Windows en zorg dat `tesseract.exe` in je `PATH` staat. Zonder Tesseract werken PDF, DOCX, TXT en MD nog steeds.

## Projectstructuur

```text
actovyna/
├── README.md                     # Uitleg
├── .env.example                  # Voorbeeldconfiguratie, géén echte sleutel
├── .gitignore                    # Houdt sleutels en databasebestanden buiten GitHub
├── docker-compose.yml            # Start PostgreSQL + FastAPI + webinterface
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # API-routes
│   │   ├── db.py                  # Databaseverbinding
│   │   ├── models.py              # Documenten en taken
│   │   ├── schemas.py             # Validatie en API-vormen
│   │   └── analyzer.py            # PDF, Word, OCR, deadlines, optionele AI
│   └── tests/
│       ├── conftest.py
│       └── test_api.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── public/favicon.svg
    └── src/
        ├── main.tsx
        ├── App.tsx                # Functionele interface
        └── styles.css            # Vormgeving
```

## Naar GitHub

Dit project is **geen GitHub Pages-site**. GitHub bewaart de broncode, maar voert geen Python-backend of PostgreSQL uit voor een statische Pages-website. Voor lokaal gebruik: start hem met Docker of Python+Node.

1. Maak op GitHub een repository **`actovyna`**.
2. Pak `actovyna.zip` uit op je eigen computer.
3. Gebruik GitHub **Add file → Upload files** of Git om de projectbestanden en mappen te uploaden (niet het ZIP-bestand zelf).
4. Zet nooit `.env`, `node_modules` of databasebestanden op GitHub.

Als je repository al een README heeft, is een bestaande `git clone` en daarna je projectbestanden toevoegen meestal het gemakkelijkst.

## Testen

Vanuit de map `backend`:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q tests
```

Vanuit de map `frontend`:

```bash
npm install
npm run build
```

## Privacy en betrouwbaarheid

- **Lokaal als standaard:** alleen uitgelezen tekst wordt verwerkt en in je eigen lokale database opgeslagen. Bestanden worden maximaal 8 MB geaccepteerd.
- **AI is opt-in:** de schakelaar staat standaard uit. Wanneer geactiveerd, gaan tekstfragmenten naar OpenAI. De toegang tot de API en het databeleid zijn afzonderlijk van lokaal gebruik.
- **Geëxtraheerde tekst kan vertrouwelijke informatie bevatten.** Kies alleen AI als je toestemming hebt om de inhoud te versturen.
- **Datums zijn mogelijkheden, niet garanties.** Markeer een gedetecteerde deadline nooit als definitieve verplichting zonder het document te controleren.
- **Niet geschikt voor juridisch/medisch/financieel beslissen zonder professionele controle.**
- **Geen online accountbeveiliging:** laat de API niet openbaar op het internet luisteren totdat authenticatie, rechten, logging, netwerkbeveiliging en back-ups zijn ingericht.
- **Geen volledige OCR voor gescande PDF's:** losse afbeeldingen kunnen wel via Tesseract worden gelezen.

## API-routes

| Methode | Route | Functie |
|---|---|---|
| GET | `/api/health` | Server en optionele functies |
| GET | `/api/stats` | Dashboardsamenvatting |
| GET | `/api/documents` | Documentenlijst |
| POST | `/api/documents?use_ai=false` | Upload en analyse van één bestand |
| GET | `/api/documents/{id}` | Document en volledige tekst |
| DELETE | `/api/documents/{id}` | Document en gekoppelde taken verwijderen |
| GET | `/api/tasks` | Takenlijst |
| POST | `/api/tasks` | Nieuwe taak |
| PATCH | `/api/tasks/{id}` | Status wijzigen |
| DELETE | `/api/tasks/{id}` | Taak verwijderen |
| GET | `/api/export` | Download JSON-export |

## Volgende stappen voor een publieke versie

Authenticatie en gebruikerstoegang, veilige cloudopslag, migraties (Alembic), per-gebruikerlimieten, antivirus-scanning, verbeterde OCR voor gescande PDF's, meertalige datumdetectie, notificaties, toegankelijkheids- en browserchecks, continue integratie en automatiseringstests.

---

**ACTOVYNA — More clarity. Less chaos.**
