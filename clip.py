"""Step 1: find short badminton clips on YouTube, from a list of trusted channels."""
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
API_KEY = os.environ["YOUTUBE_API_KEY"]  # from .env locally, GitHub Secrets in Actions
SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
MAX_SECONDS = 90  # only keep clips this short or shorter


def to_seconds(iso_duration):
    """Turn YouTube's duration format (like 'PT1M5S') into seconds.

    Returns None for anything else, such as 'P0D' on livestreams and premieres."""
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso_duration)
    if match is None:
        return None
    hours, minutes, seconds = (int(x or 0) for x in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def is_vertical(video):
    """True for portrait videos (YouTube Shorts), judged from the embed size."""
    player = video.get("player", {})
    try:
        return int(player["embedHeight"]) > int(player["embedWidth"])
    except (KeyError, ValueError):
        return False


def find_candidates(query, channel_id, hours=48, max_seconds=MAX_SECONDS, max_results=25):
    """Short videos on one channel matching `query`, most-viewed first.

    hours=48 means "uploaded in the last 48 hours"; hours=None means any time
    (used for throwbacks: the most-viewed clips ever). An empty query means
    "any video on the channel"."""
    params = {
        "part": "snippet",
        "channelId": channel_id,
        "type": "video",
        "videoDuration": "short",  # YouTube's "under 4 minutes" filter
        "order": "viewCount",
        "maxResults": max_results,
        "key": API_KEY,
    }
    if query:
        params["q"] = query
    if hours is not None:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        params["publishedAfter"] = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    response = requests.get(SEARCH_URL, params=params, timeout=30)
    response.raise_for_status()
    ids = [item["id"]["videoId"] for item in response.json().get("items", [])]
    if not ids:
        return []

    # Search results don't include views, length, tags or shape, so ask separately.
    details = requests.get(VIDEOS_URL, timeout=30, params={
        "part": "snippet,statistics,contentDetails,player",
        "id": ",".join(ids),
        "maxWidth": 1000,  # makes YouTube report the embed size, which gives the shape
        "key": API_KEY,
    })
    details.raise_for_status()

    clips = []
    for video in details.json().get("items", []):
        seconds = to_seconds(video["contentDetails"]["duration"])
        if seconds is None or seconds > max_seconds:
            continue  # a livestream, or too long to be a single play
        snippet = video["snippet"]
        clips.append({
            "id": video["id"],
            "title": snippet["title"],
            "channel": snippet["channelTitle"],
            "description": snippet["description"][:300],
            # BWF puts player names in the tags; drop internal IDs like "p_65267".
            "tags": [t for t in snippet.get("tags", []) if not re.match(r"^[a-z]_", t)][:15],
            "published": snippet["publishedAt"][:10],  # YYYY-MM-DD
            "views": int(video["statistics"].get("viewCount", 0)),
            "seconds": seconds,
            "vertical": is_vertical(video),
            "url": f"https://www.youtube.com/watch?v={video['id']}",
        })
    return clips


def find_many(searches, skip_ids=(), **options):
    """Run several (query, channel_id) searches and merge them, most-viewed first.
    Duplicates and videos in `skip_ids` (already featured) are left out."""
    seen = set(skip_ids)
    merged = []
    for query, channel_id in searches:
        for clip in find_candidates(query, channel_id, **options):
            if clip["id"] not in seen:
                seen.add(clip["id"])
                merged.append(clip)
    return sorted(merged, key=lambda c: c["views"], reverse=True)


if __name__ == "__main__":
    for clip in find_candidates("", "UChh-akEbUM8_6ghGVnJd6cQ")[:5]:  # BWF TV, last 48h
        shape = "vertical" if clip["vertical"] else "wide"
        print(f"{clip['views']:>10,} views | {clip['seconds']}s | {shape} | {clip['title']}")
