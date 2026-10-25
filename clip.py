"""Step 1: find today's top single-goal clips (short videos) on YouTube."""
import os
import re
from datetime import datetime, timedelta, timezone

import requests


def load_env_file(path=".env"):
    """Copy KEY=value lines from a .env file into os.environ (real env vars win)."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_env_file()
API_KEY =os.environ["YOUTUBE_API_KEY"]  # set this in your terminal first
SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
MAX_SECONDS = 90  # only keep clips this short or shorter


def to_seconds(iso_duration):
    """Turn YouTube's duration format (like 'PT1M5S') into seconds."""
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso_duration)
    hours, minutes, seconds = (int(x or 0) for x in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def find_candidates(query, hours=24, max_results=25):
    """Search for short videos matching `query` uploaded in the last `hours` hours."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "videoDuration": "short",  # YouTube's "under 4 minutes" filter
        "order": "viewCount",
        "publishedAfter": since.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "maxResults": max_results,
        "key": API_KEY,
    }
    response = requests.get(SEARCH_URL, params=params, timeout=30)
    response.raise_for_status()
    items = response.json().get("items", [])
    ids = [item["id"]["videoId"] for item in items]
    if not ids:
        return []

    # Search results don't include views or exact length, so ask separately.
    stats_params = {
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(ids),
        "key": API_KEY,
    }
    stats = requests.get(VIDEOS_URL, params=stats_params, timeout=30)
    stats.raise_for_status()

    clips = []
    for video in stats.json().get("items", []):
        seconds = to_seconds(video["contentDetails"]["duration"])
        if seconds > MAX_SECONDS:
            continue  # skip anything too long to be a single goal
        clips.append(
            {
                "id": video["id"],
                "title": video["snippet"]["title"],
                "channel": video["snippet"]["channelTitle"],
                "description": video["snippet"]["description"][:300],
                "views": int(video["statistics"].get("viewCount", 0)),
                "seconds": seconds,
                "url": f"https://www.youtube.com/watch?v={video['id']}",
            }
        )
    return sorted(clips, key=lambda c: c["views"], reverse=True)


if __name__ == "__main__":
    candidates = find_candidates("soccer goal")
    if not candidates:
        print("No short clips found. Try hours=48 in find_candidates().")
    for clip in candidates[:5]:
        print(f"{clip['views']:>10,} views | {clip['seconds']}s | {clip['title']}")
        print(f"           {clip['channel']} | {clip['url']}\n")