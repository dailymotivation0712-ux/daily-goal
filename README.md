# The Daily Shuttle 🏸

A free daily newsletter with **one badminton play of the day**: the best smash, save,
deception or rally from a BWF tournament in the last 48 hours. On quiet days it
sends a famous throwback instead.

**Website:** https://dailymotivation0712-ux.github.io/daily-goal/

## How it works

Every day at 12:00 UTC, [GitHub Actions](.github/workflows/daily.yml) runs:

| Step | File | What it does |
|---|---|---|
| 1 | [`clip.py`](clip.py) | Searches trusted official YouTube channels (BWF TV, Olympic and Paralympic Games, badminton federations) for short clips |
| 2 | [`pick_clip.py`](pick_clip.py) | An OpenAI model picks the best single play from a BWF tournament, labels it (Smash, Defence, ...) and writes a one-line blurb. Nothing good in 48 hours? It picks a classic at least 6 months old. Never repeats a clip |
| 2b | [`play_time.py`](play_time.py) | For clips over a minute, links 10 seconds before the big moment if viewers' comments say when it happens |
| 3 | [`send_email.py`](send_email.py) | Builds the email and sends it through [Buttondown](https://buttondown.com) |
| 4 | [`publish_site.py`](publish_site.py) | Updates today's play and the past-plays archive on the website ([`docs/`](docs)) |

Clips are linked and embedded from YouTube, never downloaded or re-hosted, and every
clip credits its channel.

## Running it locally

1. Install Python 3.10+ and run `pip install -r requirements.txt`.
2. Create a `.env` file (it is git-ignored, never commit it):
   ```
   YOUTUBE_API_KEY=...
   OPENAI_API_KEY=...
   BUTTONDOWN_API_KEY=...
   ```
3. Run the steps:
   ```
   python pick_clip.py      # writes todays_picks.json
   python send_email.py     # saves a DRAFT in Buttondown (add --send to really send)
   python publish_site.py   # updates docs/today.json and docs/archive.json
   ```
4. Preview the website: `python -m http.server 8000 --directory docs`, then open http://localhost:8000.

## Settings on GitHub

- **Secrets** (Settings → Secrets and variables → Actions): `YOUTUBE_API_KEY`, `OPENAI_API_KEY`, `BUTTONDOWN_API_KEY`.
- **Variable** `SEND_EMAILS` = `true` to send real emails. Without it, the daily run only saves drafts.
- **Pages**: deploy from branch `main`, folder `/docs`.

## Disclaimer

The Daily Shuttle is an independent fan project. It is not affiliated with, endorsed by
or sponsored by the Badminton World Federation (BWF). All clips belong to the channels
credited and play on YouTube.
