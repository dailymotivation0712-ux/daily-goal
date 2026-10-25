"""Step 4: update the website - today's goal (docs/today.json) and the
past-goals archive (docs/archive.json, newest first)."""
import json
import os

TODAY = os.path.join("docs", "today.json")
ARCHIVE = os.path.join("docs", "archive.json")
SPORT = "soccer"


def main():
    with open("todays_picks.json", encoding="utf-8") as f:
        today = json.load(f)
    with open(TODAY, "w", encoding="utf-8") as f:
        json.dump(today, f, indent=2)

    pick = today["picks"].get(SPORT)
    if pick is None:
        print("No pick today, archive unchanged.")
        return

    archive = []
    if os.path.exists(ARCHIVE):
        with open(ARCHIVE, encoding="utf-8") as f:
            archive = json.load(f)
    # If the job runs twice in one day, replace that day's entry instead of duplicating it.
    archive = [entry for entry in archive if entry["date"] != today["date"]]
    archive.insert(0, {
        "date": today["date"],
        "id": pick["id"],
        "title": pick["title"],
        "channel": pick["channel"],
        "blurb": pick["blurb"],
        "link": pick["link"],
    })
    with open(ARCHIVE, "w", encoding="utf-8") as f:
        json.dump(archive, f, indent=2)
    print(f"Website updated: {len(archive)} goal(s) in the archive.")


if __name__ == "__main__":
    main()
