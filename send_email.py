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
SPORT = "soccer"  # one sport for now (tags cost extra on Buttondown)
SITE_URL = "https://dailymotivation0712-ux.github.io/daily-goal/"

# Top Bins colours (same as docs/style.css)
NIGHT, PITCH, LINE = "#06120d", "#0c2419", "#1f3a2d"
CHALK, MUTED, LIME, LIME_INK = "#f4f7f2", "#a3b8ad", "#d4ff3a", "#10200a"
DISPLAY_FONT = "Anton, Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif"
BODY_FONT = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

# Email apps ignore stylesheets and most modern CSS, so this is table layout
# with inline styles. Placeholders in {braces} are filled in by build_email().
EMAIL_TEMPLATE = """<!-- buttondown-editor-mode: fancy -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{night};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:{pitch};border:1px solid {line};border-radius:18px;">

    <!-- Header: logo + date -->
    <tr><td style="padding:22px 28px;border-bottom:1px solid {line};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-family:{display};font-size:26px;letter-spacing:1px;text-transform:uppercase;">
          <a href="{site}" style="color:{chalk};text-decoration:none;">Top Bins<span style="color:{lime};">&#9679;</span></a>
        </td>
        <td align="right" style="font-family:{body};font-size:13px;color:{muted};">{day}</td>
      </tr></table>
    </td></tr>

    <!-- Headline -->
    <tr><td style="padding:30px 28px 18px;">
      <p style="margin:0 0 8px;font-family:{body};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:{lime};">&#9917; Goal of the Day</p>
      <h1 style="margin:0;font-family:{display};font-size:34px;line-height:1.1;font-weight:400;text-transform:uppercase;color:{chalk};">{title}</h1>
    </td></tr>

    <!-- Thumbnail (loaded from YouTube) -->
    <tr><td style="padding:0 28px;">
      <a href="{link}"><img src="{thumbnail}" width="544" alt="Watch: {title}" style="display:block;width:100%;max-width:544px;height:auto;border:0;border-radius:12px;"></a>
    </td></tr>

    <!-- Blurb + button -->
    <tr><td style="padding:22px 28px 30px;">
      <p style="margin:0 0 24px;font-family:{body};font-size:17px;line-height:1.6;color:{chalk};">{blurb}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:{lime};border-radius:999px;">
          <a href="{link}" style="display:inline-block;padding:14px 28px;font-family:{body};font-size:16px;font-weight:700;color:{lime_ink};text-decoration:none;">&#9654; Watch the goal</a>
        </td>
      </tr></table>
      <p style="margin:18px 0 0;font-family:{body};font-size:13px;color:{muted};">Video by {channel} on YouTube.</p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 28px;border-top:1px solid {line};font-family:{body};font-size:14px;color:{muted};">
      Missed one? <a href="{site}archive.html" style="color:{lime};font-weight:700;text-decoration:none;">See past goals &rarr;</a>
    </td></tr>

  </table>
</td></tr>
</table>
"""


def build_email(pick, day):
    """Subject line and Top Bins-styled HTML body for one clip."""
    subject = f"⚽ Goal of the Day: {day.strftime('%b %d').replace(' 0', ' ')}"
    # html.escape so a video title containing < or & can't break the email.
    body = EMAIL_TEMPLATE.format(
        night=NIGHT, pitch=PITCH, line=LINE, chalk=CHALK, muted=MUTED,
        lime=LIME, lime_ink=LIME_INK, display=DISPLAY_FONT, body=BODY_FONT,
        site=SITE_URL,
        day=day.strftime("%A, %B %d").replace(" 0", " "),
        title=html.escape(pick["title"]),
        blurb=html.escape(pick["blurb"]),
        channel=html.escape(pick["channel"]),
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
