"""Step 3: turn today's pick into a Buttondown email.

    py send_email.py          -> saves a DRAFT in Buttondown (nothing is sent)
    py send_email.py --send   -> creates the email and sends it to all subscribers
"""
import html
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
SPORT = "badminton"
SITE_URL = "https://dailymotivation0712-ux.github.io/daily-goal/"

# The Daily Shuttle "Sunny Court" colours and fonts (same as docs/style.css).
# Apple Mail and iPhone show the web fonts; Gmail and Outlook use the fallbacks.
INK, PAGE, HERO, ACCENT, SECOND = "#1d1b2e", "#fff8ec", "#ffd23f", "#ff5a36", "#2ec4b6"
DISPLAY = "'Lilita One', 'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif"
BODY = "Nunito, 'Trebuchet MS', Helvetica, Arial, sans-serif"

# Email apps ignore stylesheets and most modern CSS, so this is table layout
# with inline styles. Placeholders in {braces} are filled in by build_email().
EMAIL_TEMPLATE = """<!-- buttondown-editor-mode: fancy -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{page};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="max-width:600px;background:#ffffff;border:3px solid {ink};border-radius:22px;box-shadow:6px 6px 0 {ink};overflow:hidden;">

    <!-- Sunny header -->
    <tr><td style="background:{hero};padding:20px 26px;border-bottom:3px solid {ink};border-radius:19px 19px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-family:{display};font-size:28px;color:{ink};">
          <a href="{site}" style="color:{ink};text-decoration:none;">The Daily Shuttle &#127992;</a>
        </td>
        <td align="right">
          <span style="display:inline-block;padding:6px 12px;border:2px solid {ink};border-radius:999px;background:#ffffff;font-family:{body};font-size:13px;font-weight:800;color:{ink};">{day}</span>
        </td>
      </tr></table>
    </td></tr>

    <!-- Label + title -->
    <tr><td style="padding:28px 26px 16px;">
      <span style="display:inline-block;padding:6px 14px;border-radius:999px;background:{ink};font-family:{body};font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:{hero};">{label}</span>
      <h1 style="margin:14px 0 0;font-family:{display};font-size:32px;line-height:1.1;font-weight:400;color:{ink};">{title}</h1>
    </td></tr>

    <!-- Thumbnail -->
    <tr><td style="padding:0 26px;">
      <a href="{link}"><img src="{thumbnail}" width="542" alt="Watch: {title}" style="display:block;width:100%;max-width:542px;height:auto;border:3px solid {ink};border-radius:16px;"></a>
    </td></tr>

    <!-- Blurb + button -->
    <tr><td style="padding:22px 26px 28px;">
      <p style="margin:0 0 22px;font-family:{body};font-size:17px;line-height:1.6;font-weight:600;color:{ink};">{blurb}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:{accent};border:3px solid {ink};border-radius:999px;box-shadow:3px 3px 0 {ink};">
          <a href="{link}" style="display:inline-block;padding:13px 28px;font-family:{body};font-size:17px;font-weight:800;color:#ffffff;text-decoration:none;">&#9654; Watch the play</a>
        </td>
      </tr></table>
      <p style="margin:18px 0 0;font-family:{body};font-size:13px;font-weight:600;color:#5b5870;">{credit}</p>
    </td></tr>

    <!-- Teal footer -->
    <tr><td style="background:{second};padding:20px 26px 22px;border-top:3px solid {ink};border-radius:0 0 19px 19px;">
      <p style="margin:0;font-family:{body};font-size:15px;font-weight:800;color:{ink};">
        Missed one? <a href="{site}archive.html" style="color:{ink};text-decoration:underline;">See past plays &rarr;</a>
      </p>
      <p style="margin:12px 0 0;font-family:{body};font-size:12px;line-height:1.5;font-weight:600;color:{ink};">
        The Daily Shuttle is an independent fan newsletter. It is not affiliated with,
        endorsed by or sponsored by the Badminton World Federation (BWF). Clips belong
        to the channels credited above and play on YouTube.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
"""



def build_email(pick, day):
    """Subject line and Sunny Court-styled HTML body for one play."""
    nice_day = day.strftime("%b %d").replace(" 0", " ")
    category = pick["category"]
    play = category if category == "Top play" else f"Best {category}"  # not "Best Top play"
    channel = html.escape(pick["channel"])
    if pick["throwback"]:
        subject = f"🏸 Throwback: {play} ({nice_day})"
        label = f"&#8634; Throwback &middot; {play}"
        posted = date.fromisoformat(pick["published"]).strftime("%B %Y")
        credit = f"Clip: <strong>{channel}</strong> on YouTube &middot; first posted {posted}"
    else:
        subject = f"🏸 Play of the Day: {play} ({nice_day})"
        label = f"&#127992; Play of the Day &middot; {play}"
        credit = f"Clip: <strong>{channel}</strong> on YouTube"

    # html.escape so a video title containing < or & can't break the email.
    body = EMAIL_TEMPLATE.format(
        page=PAGE, ink=INK, hero=HERO, accent=ACCENT, second=SECOND, display=DISPLAY, body=BODY,
        site=SITE_URL,
        day=nice_day,
        preheader=html.escape(pick["blurb"]),
        label=label,
        title=html.escape(pick["title"]),
        blurb=html.escape(pick["blurb"]),
        credit=credit,
        link=html.escape(pick["link"]),
        thumbnail=f"https://i.ytimg.com/vi/{pick['id']}/hqdefault.jpg",  # served by YouTube
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
        print("No play qualified today, so no email.")
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
