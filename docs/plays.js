// Shared by index.html and archive.html: play cards, badges and the pop-up video player.

function formatDate(isoDate) {
  // Noon avoids the date shifting a day in time zones behind UTC.
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function playTags(entry) {
  // Small badges: "Best Smash", plus "Throwback · 2019" for classic clips.
  const tags = document.createElement("div");
  tags.className = "tags";
  if (entry.category) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = entry.category === "Top play" ? "Top play" : `Best ${entry.category}`;
    tags.append(tag);
  }
  if (entry.throwback) {
    const tag = document.createElement("span");
    tag.className = "tag tag-throwback";
    tag.textContent = entry.published ? `↺ Throwback · ${entry.published.slice(0, 4)}` : "↺ Throwback";
    tags.append(tag);
  }
  return tags;
}

function playerFrame(entry, autoplay) {
  // YouTube's embedded player: the video still plays from YouTube, nothing is re-hosted.
  const src = new URL(`https://www.youtube-nocookie.com/embed/${entry.id}`);
  const start = new URL(entry.link).searchParams.get("t"); // 10s before a late moment
  if (start) src.searchParams.set("start", parseInt(start, 10));
  if (autoplay) src.searchParams.set("autoplay", "1");

  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = entry.title;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  return iframe;
}

let playerDialog = null;

function openPlayer(entry) {
  if (!playerDialog) {
    playerDialog = document.createElement("dialog");
    playerDialog.className = "player-dialog";
    playerDialog.innerHTML = `
      <div class="dialog-frame"></div>
      <div class="dialog-bar">
        <div>
          <p class="play-date"></p>
          <h3 class="dialog-title"></h3>
        </div>
        <button class="dialog-close" type="button" aria-label="Close video">✕</button>
      </div>`;
    playerDialog.querySelector(".dialog-close").addEventListener("click", () => playerDialog.close());
    // Clicking the dark area outside the player closes it too.
    playerDialog.addEventListener("click", (event) => {
      if (event.target === playerDialog) playerDialog.close();
    });
    // Removing the iframe on close is what stops the video playing in the background.
    playerDialog.addEventListener("close", () => {
      playerDialog.querySelector(".dialog-frame").replaceChildren();
    });
    document.body.append(playerDialog);
  }

  playerDialog.classList.toggle("is-vertical", Boolean(entry.vertical)); // Shorts get a tall frame
  playerDialog.querySelector(".play-date").textContent = entry.date ? formatDate(entry.date) : "";
  playerDialog.querySelector(".dialog-title").textContent = entry.title;
  playerDialog.querySelector(".dialog-frame").replaceChildren(playerFrame(entry, true));
  playerDialog.showModal();
}

function playCard(entry) {
  // Built with textContent (not innerHTML) so a video title can never inject HTML.
  // It's a real link to YouTube, so Ctrl+click / middle-click still opens a new tab.
  const card = document.createElement("a");
  card.className = "play-card";
  card.href = entry.link;
  card.target = "_blank";
  card.rel = "noopener";
  card.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    openPlayer(entry);
  });

  const media = document.createElement("div");
  media.className = "play-media";
  const thumb = document.createElement("img");
  thumb.className = "play-thumb";
  thumb.src = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`; // served by YouTube
  thumb.alt = "";
  thumb.loading = "lazy";
  const play = document.createElement("span");
  play.className = "play-badge";
  play.setAttribute("aria-hidden", "true");
  play.textContent = "▶";
  media.append(thumb, play);

  const body = document.createElement("div");
  body.className = "play-body";
  const date = document.createElement("p");
  date.className = "play-date";
  date.textContent = formatDate(entry.date);
  const title = document.createElement("h3");
  title.textContent = entry.title;
  const blurb = document.createElement("p");
  blurb.className = "play-blurb";
  blurb.textContent = entry.blurb;
  const credit = document.createElement("p");
  credit.className = "play-credit";
  credit.textContent = `Clip: ${entry.channel}`;
  body.append(date, playTags(entry), title, blurb, credit);

  card.append(media, body);
  return card;
}

function loadArchive() {
  return fetch("archive.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => []);
}
