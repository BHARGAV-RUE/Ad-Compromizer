# Ad Compromizer

**Browse without unwanted redirects.**

Ad Compromizer is a Chrome extension (Manifest V3) that protects a single, chosen browser tab from unwanted ad/redirect hijacking. Unlike a traditional ad blocker, it does **not** block requests, maintain a blacklist, or prevent redirects from happening. Instead it follows a detect-and-recover model:

```
ALLOW REDIRECT → DETECT REDIRECT → ESCAPE THE REDIRECT → RESTORE PRIMARY PAGE
```

The redirect is allowed to fire (since many redirect mechanisms are impossible to reliably intercept beforehand without breaking normal site behavior), and the extension reacts immediately afterward by forcing the protected tab back to the last known legitimate URL.

---

## 1. Core Concept

You designate **one tab** as the **Primary Tab** — the page you want to stay on (e.g. a video/streaming page prone to ad-injected redirects). You then turn on **Protection** for that tab. From that point on:

- If the Primary Tab itself gets redirected (301/302, `window.location`, `location.replace()`, meta refresh, JS-driven redirect chains), the extension detects it and forces the tab back to the last legitimate URL.
- If the page instead **opens a new tab** (a very common ad pattern — `window.open`, `target="_blank"` hijacks), that new tab is left open but flagged as **EVIL**, and focus is bounced back to the Primary Tab automatically.

Primary Tab selection and Protection are two **independent** switches — selecting a Primary Tab does not turn Protection on, and turning Protection off does not clear the Primary Tab.

---

## 2. Installation

1. Download/clone the extension folder (must contain `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `styles.css`, `icons/`).
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extension folder.
5. Pin the extension icon to your toolbar for quick access.

No account, login, or external server is involved — everything runs locally via `chrome.storage.local`.

---

## 3. How to Use It

**Step 1 — Set a Primary Tab**
Open the page you want to protect, click the extension icon, and press **Set as Primary Tab**. The button turns blue and reads "Remove Primary" while you're on that tab; on any other tab it reads "Set as Primary" in green.

**Step 2 — Enable Protection**
Press **Enable Protection**. This is only allowed once a Primary Tab exists — the button turns blue and reads "Disable Protection" while active.

**Step 3 — Browse normally**
If the Primary Tab gets redirected by an ad, it will automatically snap back to the page you were on. The **Redirects Detected** counter in the popup increments each time this happens.

**Step 4 — Handle popped-up tabs**
If an ad instead opens a *new* tab, that tab is tagged EVIL: a floating 😈 button appears in its bottom-right corner, and your browser focus is returned to the Primary Tab. You can:
- Click 😈 on the new tab to mark it **NOT_EVIL** (😺) if it turned out to be something you actually wanted to keep.
- Click **Clear EVIL Redirect Tabs** in the popup to close every tab still marked EVIL in one action. Tabs you flipped to NOT_EVIL are left alone.

**Step 5 — Turn it off**
Press **Disable Protection** to pause monitoring without losing your Primary Tab, or **Remove Primary** to fully reset (also disables Protection and clears the redirect count/tab list).

You can also do all of the above from the right-click context menu: *Set as Primary Tab*, *Enable Protection*, *Disable Protection*, *Clear Redirect Tabs*.

---

## 4. Technical Breakdown

### 4.1 State model
Everything lives in `chrome.storage.local`:

| Key | Purpose |
|---|---|
| `primaryTabId` | The tab ID currently protected |
| `protectionEnabled` | Whether monitoring is active |
| `lastLegitimateUrl` | The URL the Primary Tab should be restored to |
| `redirectCount` | Running total shown in the popup |
| `redirectTabs` | Array of `{ tabId, url, status }` for popped-up tabs (`EVIL` / `NOT_EVIL`) |
| `restoringPrimary` | Transient flag while a restore is in progress |

In addition, `background.js` keeps a few **in-memory** maps for fast, per-event bookkeeping (these do *not* survive a service worker restart, only `chrome.storage.local` does):
- `restoringTabs` — tracks an active restoration attempt per tab (`{ targetUrl, attempts }`).
- `redirectChainTabs` — timestamps of recent HTTP-level redirect hops, seen via `webRequest`.
- `primaryNavigationState` — last known navigation start time, used to debounce rapid-fire events.

### 4.2 Same-tab redirect detection & recovery
This is handled in `chrome.webNavigation.onCommitted` for the Primary Tab's main frame (`frameId === 0`), combined with a second, independent signal:

1. **`transitionQualifiers`** — Chrome tags some navigations `server_redirect` / `client_redirect`. This catches classic 301/302s and simple JS/meta-refresh redirects.
2. **`chrome.webRequest.onBeforeRedirect`** — records real HTTP redirect hops directly from the network layer. This catches server-side ad-redirect chains that Chrome's navigation-transition heuristic sometimes fails to tag (in particular, redirects that ride along with a user click, which Chrome can classify as an ordinary `link` transition instead of a redirect).

If either signal fires and the committed URL differs from `lastLegitimateUrl`, the extension:
- Increments `redirectCount`.
- Immediately calls `chrome.tabs.update(tabId, { url: lastLegitimateUrl })` — a **direct URL restore**, not `chrome.tabs.goBack()`. This matters because many ad redirects use `location.replace()`, which overwrites session history instead of adding to it; relying on "back" navigation can skip past the legitimate page entirely or land somewhere unrelated.
- Keeps the tab locked in `restoringTabs` until a commit event confirms the tab actually landed back on `lastLegitimateUrl` (retried up to 5 times if a straggling redirect from the same chain commits in between).

Only once the tab settles on a *new*, non-redirect URL for >100ms is `lastLegitimateUrl` updated to that new page — this lets you deliberately navigate the Primary Tab elsewhere without it being treated as a hijack.

### 4.3 New-tab (popup-style) redirect handling
`chrome.tabs.onCreated` watches for any tab whose `openerTabId` matches the Primary Tab while Protection is on. Each new tab is:
- Pushed into `redirectTabs` with `status: "EVIL"`.
- Immediately re-focused away from: `chrome.tabs.update(primaryTabId, { active: true })` plus `chrome.windows.update(..., { focused: true })` in case the ad opened a separate window. This runs a second time after a short delay, in case the new tab's own script tries to re-steal focus right after opening.

The new tab is **not closed automatically** — it's flagged and left open so you can review or reclaim it manually.

### 4.4 The EVIL / NOT_EVIL system
`content.js` runs on every page (`document_start`) and:
- Sends a `contentReady` message to `background.js` on load.
- Listens for a `redirectStatus` message and renders a floating circular button — 😈 for EVIL, 😺 for NOT_EVIL — pinned bottom-right via inline `!important` styles so host-page CSS can't override it.
- Clicking the button sends `toggleRedirectStatus` back to `background.js`, which flips the tab's status in `redirectTabs` and pushes the new status back down so the icon updates instantly.

`background.js` also re-sends the current status whenever a tracked tab finishes a new navigation (`onCommitted`, separate from the Primary Tab's redirect logic) and whenever a content script announces itself as ready — covering both same-page updates and full reloads.

### 4.5 Clearing EVIL tabs
Both the popup button and the context-menu item call `clearEvilRedirectTabs()`:
- Iterates `redirectTabs`.
- Calls `chrome.tabs.remove()` on every entry still marked `EVIL`.
- Rebuilds `redirectTabs` keeping only the `NOT_EVIL` entries, so tabs you've explicitly kept are never touched.

### 4.6 Permissions used

| Permission | Why |
|---|---|
| `tabs` | Read/update tab URLs, create/remove tabs, query active tab |
| `storage` | Persist all state locally |
| `contextMenus` | Right-click menu actions |
| `webNavigation` | Detect committed navigations, transition qualifiers, history-state changes, navigation errors |
| `webRequest` | Observe HTTP-level redirect chains (`onBeforeRedirect`) as a second detection signal |
| `windows` | Refocus the correct browser window when an ad opens a tab in a separate window |
| `host_permissions: <all_urls>` | Required for `webNavigation`/`webRequest` to observe navigation on any site, and for `content.js` to inject the EVIL/NOT_EVIL button everywhere |

No permission here allows reading page content, form data, or network payloads — only navigation/redirect *metadata* (URLs, tab/window IDs, timing).

---

## 5. Browser Compatibility

Built and tested against Chrome's Manifest V3 (`chrome.*` namespace, `service_worker` background).

- **Runs unmodified** on any Chromium-based browser: Edge, Brave, Opera, Vivaldi, Arc, and Chromium-based Android browsers (e.g. Kiwi).
- **Firefox** needs `background.service_worker` swapped for `background.scripts` (Firefox uses event pages, not service workers) plus a `browser_specific_settings.gecko` block; the `chrome.*` callback APIs used here are otherwise supported natively.
- **Safari** requires converting the extension via Xcode's Safari Web Extension converter and reworking the redirect-detection layer, since Safari's `webRequest` support is significantly more restricted and the `onBeforeRedirect` chain-tracking used here has no direct equivalent.

---

## 6. Known Limitations

- Service workers in MV3 are event-driven and can be terminated after a period of inactivity; the in-memory maps (`restoringTabs`, `redirectChainTabs`, `primaryNavigationState`) reset if that happens mid-incident, though `chrome.storage.local` state (Primary Tab, Protection, counters) survives.
- Redirects triggered via a genuine user click can be indistinguishable from a script-simulated "click-hijack" redirect at the API level — Chrome doesn't expose enough signal to tell them apart with certainty in all cases. The `webRequest`-based chain tracking narrows this gap for server-side redirects but isn't a complete guarantee for every JS-driven pattern.
- Only one Primary Tab is supported at a time.

  
