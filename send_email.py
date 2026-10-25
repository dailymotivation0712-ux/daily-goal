"""Step 3: turn today's pick into a Buttondown email.

    py send_email.py          -> saves a DRAFT in Buttondown (nothing is sent)
    py send_email.py --send   -> creates the email and sends it to all subscribers
"""
import json
import os
import sys
from datetime import date

import requests

from clip import load_env_file

load_env_file()
API_KEY = os.environ["BUTTONDOWN_API_KEY"]
EMAILS_URL = "https://api.buttondown.com/v1/emails"
HEADERS = {"Authorization": f"Token {API_KEY}"}
SPORT = "soccer"  # one sport for now (tags cost extra on Buttondown)


def build_email(pick, day):
    """Subject line and Markdown body for one clip."""
    title = pick["title"].replace("[", "(").replace("]", ")")  # brackets break Markdown links
    thumbnail = f"https://i.ytimg.com/vi/{pick['id']}/hqdefault.jpg"  # served by YouTube
    subject = f"⚽ Goal of the Day: {day.strftime('%b %d').replace(' 0', ' ')}"
    body = (
        f"[![{title}]({thumbnail})]({pick['link']})\n\n"
        f"**{title}**\n\n"
        f"{pick['blurb']}\n\n"
        f"[▶ Watch the goal on YouTube]({pick['link']})\n\n"
        f"*Video by {pick['channel']} on YouTube.*\n"
    )
    return subject, body


def check(response, action):
    """Stop with Buttondown's own error message if a request failed."""
    if not response.ok:
        raise RuntimeError(f"Buttondown {action} failed ({response.status_code}): {response.text}")
    return response.json()


def main(send):
    with open("todays_picks.json", encoding="utf-8") as f:
        today = json.load(f)
    pick = today["picks"].get(SPORT)
    if pick is None:
        print("No clip qualified today, so no email.")
        return

    subject, body = build_email(pick, date.fromisoformat(today["date"]))
    # Always create a draft first; sending is a separate, deliberate step.
    email = check(
        requests.post(EMAILS_URL, headers=HEADERS, timeout=30,
                      json={"subject": subject, "body": body, "status": "draft"}),
        "create draft",
    )
    print(f"Draft saved: {subject}")

    if send:
        check(
            requests.patch(f"{EMAILS_URL}/{email['id']}", headers=HEADERS, timeout=30,
                           json={"status": "about_to_send"}),
            "send",
        )
        print("Sent to all subscribers.")
    else:
        print("Not sent. Check it in your Buttondown dashboard (Emails > Drafts).")


if __name__ == "__main__":
    main(send="--send" in sys.argv)
