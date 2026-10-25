"""Find when the goal happens in a clip, using timestamps people wrote in the
description and comments (we never download or watch the video itself)."""
import re

import requests

from clip import API_KEY

COMMENTS_URL = "https://www.googleapis.com/youtube/v3/commentThreads"
LONG_VIDEO = 60  # only look for a goal time in videos longer than this
QUICK_ENOUGH = 20  # goal within this many seconds: the plain link is fine
LEAD_IN = 10  # start the link this many seconds before the goal so you see the build-up
GOAL_WORDS = ("goal", "golazo", "gol", "score", "finish", "strike", "shot", "header",
              "dunk", "three", "block", "play")
TIMESTAMP = re.compile(r"\b(\d{1,2}):([0-5]\d)\b")  # matches 0:45 or 1:12


def timestamps_in(text, max_seconds):
    """All m:ss times in `text` that fall inside the video."""
    times = []
    for match in TIMESTAMP.finditer(text):
        seconds = int(match.group(1)) * 60 + int(match.group(2))
        if 0 < seconds <= max_seconds:
            times.append(seconds)
    return times


def fetch_comments(video_id, max_results=100):
    """Top comments on a video. Returns [] if comments are off or the request fails."""
    params = {
        "part": "snippet",
        "videoId": video_id,
        "order": "relevance",
        "maxResults": max_results,
        "textFormat": "plainText",
        "key": API_KEY,
    }
    response = requests.get(COMMENTS_URL, params=params, timeout=30)
    if not response.ok:
        return []  # comments disabled, or quota trouble - just skip the timestamp
    return [
        item["snippet"]["topLevelComment"]["snippet"]["textDisplay"]
        for item in response.json().get("items", [])
    ]


def find_goal_time(clip):
    """Best guess (in seconds) of when the goal happens, or None if nobody says."""
    # Each text that mentions a time is a vote; mentioning a goal word counts double.
    votes = {}
    texts = clip["description"].splitlines() + fetch_comments(clip["id"])
    for text in texts:
        weight = 2 if any(word in text.lower() for word in GOAL_WORDS) else 1
        for seconds in set(timestamps_in(text, clip["seconds"])):
            votes[seconds] = votes.get(seconds, 0) + weight

    # People rarely agree to the exact second, so count votes within 2s of each time.
    best_time, best_score = None, 0
    for seconds in votes:
        score = sum(v for t, v in votes.items() if abs(t - seconds) <= 2)
        if score > best_score:
            best_time, best_score = seconds, score
    return best_time if best_score >= 2 else None  # one lone, vague mention isn't enough


def goal_link(clip):
    """The clip's URL, jumping to the goal only in long videos where it comes late."""
    if clip["seconds"] <= LONG_VIDEO:
        return clip["url"], None  # short video, the plain link is fine
    goal_at = find_goal_time(clip)
    if goal_at is None or goal_at <= QUICK_ENOUGH:
        return clip["url"], goal_at
    return f"{clip['url']}&t={goal_at - LEAD_IN}s", goal_at
