# Get a Reachy app onto Hugging Face — step by step

End result: your static Reachy app is live at
`https://<your-hf-user>-<your-space>.static.hf.space/`, judges can hit it
cold, and the dashboard's "Install to Robot" button works.

Time: ~15 minutes if everything cooperates. Most of it is admin (account,
token, web UI). Actual code push is 30 seconds.

---

## 0. What you need before starting

- A working Reachy app — for this guide it's a folder with at minimum an
  `index.html` (single file is fine). Place the folder somewhere like
  `~/Documents/my-reachy-app` and `cd` into it before any of the git
  commands.
- A Hugging Face account → https://huggingface.co/join
- Git installed and configured with your name and email (you only need
  to do this once on a new machine):

  ```bash
  git config --global user.name  "Your Name"
  git config --global user.email "you@example.com"
  ```

- (Recommended) Open the app once locally first so you know it works
  before pushing it anywhere:

  ```bash
  python -m http.server 8765
  ```

  Open `http://localhost:8765` in your browser. If your app loads, you're
  ready to deploy.

---

## 1. Create the Space on Hugging Face (web)

1. Go to **https://huggingface.co/new-space**
2. Fill in the form:
   - **Space name**: pick a lowercase, hyphen-friendly slug like
     `my-reachy-app`. This becomes part of the URL.
   - **License**: MIT is the safe default for hackathon code.
   - **Select SDK** → **Static** *(critical — not Gradio, not Docker)*
   - **Choose a Static template** → **Blank**
     *(React/Svelte/Vue templates scaffold a build step; Blank just
     serves whatever you push as-is, which is what you want for a
     single `index.html` app.)*
   - **Hardware**: CPU basic (free).
   - **Visibility**: Public.
3. Click **Create Space**.

You'll land on an empty Space page. Take note of the URL — it looks like
`https://huggingface.co/spaces/<your-hf-user>/<your-space>`. You'll need
this in step 4.

> ⚠️ The Space starts with one auto-generated commit (a placeholder
> README). Don't worry about it — step 5 deals with it.

---

## 2. Mint a write token (web)

1. https://huggingface.co/settings/tokens
2. Click **New token**.
3. Name it something like `space-push`.
4. Role: **Write**.
5. Click **Generate** and **copy the `hf_…` string**. You'll paste it as
   the password during `git push` (NOT your HF login password).

> Treat this token like a password. Anyone with it can push to any of
> your Spaces or repos. If you ever paste it somewhere public by
> accident, immediately revoke it on the same tokens page and mint a
> new one.

---

## 3. (Optional but recommended) Add a README with HF frontmatter

The Space page on huggingface.co displays a banner with title, emoji,
and gradient — but only if your `README.md` has YAML frontmatter at the
top. Without it you get a "missing metadata" warning.

Put this at the top of your `README.md` (create the file in your app
folder if you don't have one):

```yaml
---
title: My Reachy App
emoji: 🤖
colorFrom: purple
colorTo: pink
sdk: static
pinned: true
license: mit
short_description: A Reachy Mini app on the 0G stack
tags:
  - 0g-hackathon
---
```

After the closing `---`, write a normal markdown description of your
app. The `0g-hackathon` tag is what gets your Space discovered at
`huggingface.co/spaces?other=0g-hackathon` and is required if you want
the organizers to add it to the curated 0G collection.

---

## 4. Wire up git in your app folder (terminal)

From inside your app folder (`cd ~/Documents/my-reachy-app` first):

```bash
git init -b main
```

Stage everything and make the first commit:

```bash
git add .
git commit -m "Initial: Reachy app for 0G hackathon"
```

Point this local repo at your Space's URL (replace placeholders with
your actual HF username and Space name):

```bash
git remote add origin https://huggingface.co/spaces/<your-hf-user>/<your-space>
```

Sanity-check it stuck:

```bash
git remote -v
```

You should see your Space URL twice (fetch and push).

---

## 5. Push for the first time

This is the one part with a small wrinkle. Because HF auto-committed a
placeholder README when you created the Space, your local `main` and the
Space's `main` have **diverged** — your local has no parent commit, the
Space has one commit you've never seen. A plain `git push` will be
rejected.

Two ways to handle this:

### Option A — force push (recommended for a fresh Space you just made)

You're overwriting an HF-generated placeholder README that you've never
edited. There's nothing of yours on the Space yet that could be lost.

```bash
git push -u origin main --force
```

> ⚠️ **Force-push is only safe here because you literally just created
> the Space seconds ago and nothing is on it but the auto-generated
> stub.** Never force-push to a shared `main` branch in a project with
> collaborators or any history you care about.

### Option B — pull and merge instead

If you'd rather keep the HF placeholder commit in history:

```bash
git pull --rebase origin main
# Resolve any conflicts (probably the README), then:
git push -u origin main
```

Slightly more steps for an identical end result.

### Authenticating during the push

Either option will prompt for credentials. The prompt is different
depending on your OS:

- **Windows (Git Credential Manager popup)**: a small window opens.
  Username = your HF username. Password = the `hf_…` write token
  (NOT your HF login password).
- **macOS / Linux (terminal prompt)**:
  ```
  Username for 'https://huggingface.co': <your hf username>
  Password for 'https://...': <paste hf_... token>
  ```

After it succeeds you'll see something like:

```
 + abc1234...def5678 main -> main (forced update)
```

---

## 6. Verify it's live

Visit `https://<your-hf-user>-<your-space>.static.hf.space/` in a
browser. Note the URL format: it's `<user>-<space>` with a hyphen, NOT
a slash. HF takes ~20–60 seconds to build the static Space after a
push, so if you get a 404 immediately just wait and refresh.

The Space's "settings" page (huggingface.co/spaces/.../settings) also
shows build status if it's stuck or errored.

---

## 7. Subsequent updates (every time you change the app)

After the first push there's no more force-push gymnastics. Just:

```bash
git add .
git commit -m "describe what changed"
git push
```

The Space auto-rebuilds within ~30 seconds and your `static.hf.space`
URL serves the new version. Hard-refresh your browser
(Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on macOS) to clear cache.

---

## 8. (Hackathon) Submit to the 0G collection

Once your Space is live and tagged with `0g-hackathon` (from step 3),
DM the Space URL to the event organizers (in their Discord). They add
the curated `0g-hackathon` collection that gets promoted on the 0G X
account.

Tagged Spaces are also discoverable at
`huggingface.co/spaces?other=0g-hackathon` even without curation.

---

## Common errors and what they mean

| Error you see | What's wrong | Fix |
|---|---|---|
| `! [rejected] main -> main (fetch first)` on first push | The Space has the auto-generated commit, your local doesn't have it as a parent | Use the force push (step 5 option A) |
| `fatal: not a git repository` | You're not in the app folder, or you forgot `git init` | `cd` into the folder; run `git init -b main` |
| `Authentication failed` on push | Wrong username or wrong token (HF login password ≠ write token) | Re-paste the `hf_…` token as the password |
| Credential Manager keeps re-using a wrong cached token (Windows) | Cached HF entry is stale | Open Credential Manager → Windows Credentials → remove the `huggingface.co` entry → push again |
| `Unsafe attempt to load URL ... from frame with URL chrome-error://chromewebdata/` | You tried to navigate to a URL your machine can't resolve (typically `reachy-mini.local`) | Either install Apple Bonjour for Windows, or use the robot's IP directly |
| Space page says "Missing metadata" | README has no YAML frontmatter | Add the block from step 3 |
| App loads but Reachy SDK won't connect (`robot.login()` fails) | You're testing from localhost; HF OAuth only works on `*.static.hf.space` | Test the live-robot path from the HF Space URL, not localhost |

---

## TL;DR (copy-paste version)

```bash
# In the app folder:
git init -b main
git add .
git commit -m "Initial: Reachy app"
git remote add origin https://huggingface.co/spaces/<USER>/<SPACE>
git push -u origin main --force
# When prompted: username=<USER>, password=<hf_... write token>
```

Open `https://<USER>-<SPACE>.static.hf.space/` 30 seconds later. Done.
