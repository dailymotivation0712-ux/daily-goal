// Shared by index.html and archive.html: goal cards and the pop-up video player.

function formatDate(isoDate) {
  // Noon avoids the date shifting a day in time zones behind UTC.
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function playerFrame(entry, autoplay) {
  // YouTube's embedded player: the video still plays from YouTube, nothing is re-hosted.
  const src = new URL(`https://www.youtube-nocookie.com/embed/${entry.id}`);
  const start = new URL(entry.link).searchParams.get("t"); // 10s before a late goal
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
          <p class="goal-date"></p>
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

  playerDialog.querySelector(".goal-date").textContent = entry.date ? formatDate(entry.date) : "";
  playerDialog.querySelector(".dialog-title").textContent = entry.title;
  playerDialog.querySelector(".dialog-frame").replaceChildren(playerFrame(entry, true));
  playerDialog.showModal();
}

function goalCard(entry) {
  // Built with textContent (not innerHTML) so a video title can never inject HTML.
  // It's a real link to YouTube, so Ctrl+click / middle-click still opens a new tab.
  const card = document.createElement("a");
  card.className = "goal-card";
  card.href = entry.link;
  card.target = "_blank";
  card.rel = "noopener";
  card.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    openPlayer(entry);
  });

  const media = document.createElement("div");
  media.className = "goal-media";
  const thumb = document.createElement("img");
  thumb.className = "goal-thumb";
  thumb.src = `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`; // served by YouTube
  thumb.alt = "";
  thumb.loading = "lazy";
  const play = document.createElement("span");
  play.className = "play-badge";
  play.setAttribute("aria-hidden", "true");
  play.textContent = "▶";
  media.append(thumb, play);

  const body = document.createElement("div");
  body.className = "goal-body";
  const date = document.createElement("p");
  date.className = "goal-date";
  date.textContent = formatDate(entry.date);
  const title = document.createElement("h3");
  title.textContent = entry.title;
  const blurb = document.createElement("p");
  blurb.className = "goal-blurb";
  blurb.textContent = entry.blurb;
  body.append(date, title, blurb);

  card.append(media, body);
  return card;
}

function loadArchive() {
  return fetch("archive.json", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => []);
}
