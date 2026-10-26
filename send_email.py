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

# The Daily Shuttle colours (same as docs/style.css)
NIGHT, PANEL, LINE = "#0c0c0f", "#17171c", "#2a2a31"
CHALK, MUTED, ACCENT, ACCENT_INK, GOLD = "#f5f5f7", "#a1a1aa", "#ff4b3e", "#ffffff", "#ffc94d"
DISPLAY_FONT = "'Barlow Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
BODY_FONT = "Barlow, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

# Email apps ignore stylesheets and most modern CSS, so this is table layout
# with inline styles. Placeholders in {braces} are filled in by build_email().
EMAIL_TEMPLATE = """<!-- buttondown-editor-mode: fancy -->
<!-- Preview text: inboxes show this next to the subject line -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{night};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:{panel};border:1px solid {line};border-radius:18px;">

    <!-- Header: logo + date -->
    <tr><td style="padding:22px 28px;border-bottom:1px solid {line};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-family:{display};font-size:26px;font-weight:800;font-style:italic;letter-spacing:.5px;text-transform:uppercase;">
          <a href="{site}" style="color:{chalk};text-decoration:none;">The Daily Shuttle<span style="color:{accent};">&#9679;</span></a>
        </td>
        <td align="right" style="font-family:{body};font-size:13px;color:{muted};">{day}</td>
      </tr></table>
    </td></tr>

    <!-- Headline -->
    <tr><td style="padding:30px 28px 18px;">
      <p style="margin:0 0 10px;font-family:{body};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:{label_color};">{label}</p>
      <h1 style="margin:0;font-family:{display};font-size:34px;line-height:1.05;font-weight:800;font-style:italic;text-transform:uppercase;color:{chalk};">{title}</h1>
    </td></tr>

    <!-- Thumbnail (loaded from YouTube) -->
    <tr><td style="padding:0 28px;">
      <a href="{link}"><img src="{thumbnail}" width="544" alt="Watch: {title}" style="display:block;width:100%;max-width:544px;height:auto;border:0;border-radius:12px;"></a>
    </td></tr>

    <!-- Blurb + button -->
    <tr><td style="padding:22px 28px 30px;">
      <p style="margin:0 0 24px;font-family:{body};font-size:17px;line-height:1.6;color:{chalk};">{blurb}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:{accent};border-radius:999px;">
          <a href="{link}" style="display:inline-block;padding:14px 28px;font-family:{body};font-size:16px;font-weight:700;color:{accent_ink};text-decoration:none;">&#9654; Watch the play</a>
        </td>
      </tr></table>
      <p style="margin:18px 0 0;font-family:{body};font-size:13px;color:{muted};">{credit}</p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 28px 24px;border-top:1px solid {line};font-family:{body};font-size:14px;color:{muted};">
      Missed one? <a href="{site}archive.html" style="color:{accent};font-weight:700;text-decoration:none;">See past plays &rarr;</a>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:{muted};">
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
    """Subject line and The Daily Shuttle-styled HTML body for one play."""
    nice_day = day.strftime("%b %d").replace(" 0", " ")
    category = pick["category"]
    play = category if category == "Top play" else f"Best {category}"  # not "Best Top play"
    if pick["throwback"]:
        subject = f"🏸 Throwback: {play} ({nice_day})"
        label, label_color = f"&#8634; Throwback &middot; {play}", GOLD
        posted = date.fromisoformat(pick["published"]).strftime("%B %Y")
        credit = f"Clip: <strong>{html.escape(pick['channel'])}</strong> on YouTube &middot; first posted {posted}"
    else:
        subject = f"🏸 Play of the Day: {play} ({nice_day})"
        label, label_color = f"&#127992; Play of the Day &middot; {play}", ACCENT
        credit = f"Clip: <strong>{html.escape(pick['channel'])}</strong> on YouTube"

    # html.escape so a video title containing < or & can't break the email.
    body = EMAIL_TEMPLATE.format(
        night=NIGHT, panel=PANEL, line=LINE, chalk=CHALK, muted=MUTED,
        accent=ACCENT, accent_ink=ACCENT_INK, display=DISPLAY_FONT, body=BODY_FONT,
        site=SITE_URL,
        day=day.strftime("%A, %B %d").replace(" 0", " "),
        preheader=html.escape(pick["blurb"]),
        label=label,
        label_color=label_color,
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
