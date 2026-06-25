import './marketing-landing.css'

/**
 * Beehive Books marketing landing — a 1:1 port of the Claude Design export
 * (beehive-books.html). The design is static marketing markup with no
 * interactivity, so we render it verbatim via dangerouslySetInnerHTML inside a
 * `.bb-landing` wrapper (the imported CSS is fully scoped under that class).
 *
 * Deviations from the raw export, all intentional:
 *  - CTA <button>s and the logo/footer links are real <a href> with the locale
 *    prefix so navigation works.
 *  - The two binder group labels "Part I — …" / "Part II — …" use a colon
 *    instead of an em-dash (project-wide no-em-dash rule + issue #41 AC).
 *  - A pricing section was added before the closing CTA. The design shipped the
 *    full `.pricing` / `.price-card` CSS but omitted the markup; issue #41 lists
 *    a pricing preview as an acceptance criterion, so it is built here from the
 *    design's own classes.
 */
function landingHtml(locale: string): string {
  const p = `/${locale}`
  const check =
    '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'
  const hex =
    '<span class="hex"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round"/><path d="M12 8.2 15.2 10v4L12 15.8 8.8 14v-4L12 8.2Z" fill="var(--brand)"/></svg></span>'

  return `
<!-- NAV -->
<nav class="nav">
  <div class="wrap nav-inner">
    <a class="brand-mark" href="${p}">
      ${hex}
      <span>Beehive Books</span>
    </a>
    <div class="nav-right">
      <a class="btn btn-ghost" href="${p}/sign-in">Sign In</a>
      <a class="btn btn-brand" href="${p}/sign-up">Start Writing</a>
    </div>
  </div>
</nav>

<!-- HERO -->
<header class="hero">
  <div class="hero-glow"></div>
  <div class="wrap">
    <span class="badge"><span class="dot"></span>Now in open beta. Hives 1.0 just shipped</span>
    <h1>Get <span class="yellow">buzzed</span> about writing!</h1>
    <p class="hero-sub">Draft your book, build it with other writers, and share it with readers who care. More than a text editor, it's a community built to carry your book from blank page to bookshelf.</p>
    <div class="hero-cta">
      <a class="btn btn-brand" href="${p}/sign-up">Start Writing Free</a>
      <a class="btn btn-ghost" href="#features">See How It Works</a>
    </div>
  </div>
</header>

<!-- EDITOR SHOWCASE -->
<section class="showcase">
  <div class="wrap">
    <div class="showcase-caption">
      <div class="sc-item"><span class="sc-num">01</span><div><b>The Binder</b>Every part, chapter, and scene lives in one collapsible outline. Reorder chapters, nest sections, and jump anywhere in your manuscript with a single click.</div></div>
      <div class="sc-item"><span class="sc-num">02</span><div><b>Cream canvas</b>A warm, paper-like writing surface designed to feel like a real page. Distraction-free formatting, highlights, and notes that keep you in the flow of the prose.</div></div>
      <div class="sc-item"><span class="sc-num">03</span><div><b>Live status</b>Track your word goal, save state, and revision status in real time. Set targets per chapter and watch the progress bar fill as you write.</div></div>
    </div>
    <div class="panel editor-window">
      <div class="titlebar">
        <span class="dots"><i></i><i></i><i></i></span>
        <span class="breadcrumb">studio · <b>The Gilded Shore</b> · Ch. 3</span>
      </div>
      <div class="editor-cols">

        <!-- binder -->
        <aside class="binder">
          <div class="col-label">Manuscript</div>
          <div class="group-head">Front Matter</div>
          <div class="bn-row"><span class="type-dot" style="background:var(--ink-faint)"></span>Prologue<span class="status-dot" style="background:var(--acc-list)"></span><span class="idx">01</span></div>
          <div class="group-head">Part I: The Crossing</div>
          <div class="bn-row nested"><span class="type-dot" style="background:var(--acc-studio)"></span>The Letter<span class="status-dot" style="background:var(--acc-list)"></span><span class="idx">02</span></div>
          <div class="bn-row nested active"><span class="type-dot" style="background:var(--brand)"></span>The Gilded Shore<span class="status-dot" style="background:var(--acc-studio)"></span><span class="idx">03</span></div>
          <div class="bn-row nested"><span class="type-dot" style="background:var(--acc-studio)"></span>Low Tide<span class="status-dot" style="background:var(--acc-studio)"></span><span class="idx">04</span></div>
          <div class="group-head">Part II: Salt &amp; Ash</div>
          <div class="bn-row nested"><span class="type-dot" style="background:var(--ink-faint)"></span>The Harbor<span class="status-dot" style="background:var(--acc-studio)"></span><span class="idx">05</span></div>
          <div class="add-tile"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add chapter</div>
        </aside>

        <!-- canvas / paper -->
        <main class="canvas">
          <div class="toolbar">
            <span class="tb-btn"><span class="tb-text">B</span></span>
            <span class="tb-btn"><span class="tb-text" style="font-style:italic">I</span></span>
            <span class="tb-btn"><svg viewBox="0 0 24 24"><path d="M5 12h14M16 6c0-1.5-1.8-2.5-4-2.5S8 4.5 8 6M8 18c0 1.5 1.8 2.5 4 2.5"/></svg></span>
            <span class="tb-btn"><span class="tb-text">H1</span></span>
            <span class="tb-btn"><span class="tb-text">H2</span></span>
            <span class="tb-btn"><svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg></span>
            <span class="tb-btn"><svg viewBox="0 0 24 24"><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 16H4l2 2v.5H4"/></svg></span>
            <span class="tb-btn"><svg viewBox="0 0 24 24"><path d="M7 7h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7ZM7 7C7 5 6 4 4 4M21 4v6a4 4 0 0 1-4 4"/></svg></span>
            <span class="tb-btn"><svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg></span>
            <span class="tb-btn"><svg viewBox="0 0 24 24"><path d="M3 7v6a4 4 0 0 0 4 4h11M3 7l4-4M3 7l4 4"/></svg></span>
            <span class="tb-btn"><svg viewBox="0 0 24 24"><path d="M21 7v6a4 4 0 0 1-4 4H6M21 7l-4-4M21 7l-4 4"/></svg></span>
            <span class="tb-div"></span>
            <span class="tb-btn"><span class="tb-text" style="text-decoration:underline">U</span></span>
            <span class="tb-btn active"><svg viewBox="0 0 24 24"><path d="m9 11 4-4 5 5-4 4H6v-3l3-2ZM4 21h16"/></svg></span>
            <span class="tb-btn"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg></span>
            <span class="tb-btn"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h11M4 18h16"/></svg></span>
          </div>
          <div class="prose">
            <div class="ch-eyebrow">Chapter 03</div>
            <h2>The Gilded Shore</h2>
            <p>The tide had pulled back further than Mara had ever seen, baring a coastline she did not recognize. Where the harbor wall should have stood there was only <span class="hl">a long ribbon of wet gold</span>, glittering under a sky the color of cooled iron.</p>
            <p>She walked out across it, boots sinking, the air sharp with salt and something older underneath. Each step uncovered another small ruin: a door handle, half a window frame, the spine of a book swollen shut by the sea.</p>
            <p>By the time she reached the edge of the receding water, the town behind her had gone quiet, as if it too were holding its breath to see what the shore would give back<span class="caret"></span></p>
          </div>
        </main>

        <!-- metadata -->
        <aside class="meta">
          <div class="meta-sec">
            <div class="save-row"><span class="status-dot" style="background:var(--acc-list)"></span>Saved<span class="wc">1,348 words</span></div>
          </div>
          <div class="meta-sec">
            <div class="col-label" style="margin-bottom:8px">Word Goal</div>
            <div class="meta-val">62% of 1,200</div>
            <div class="track"><div class="fill"></div></div>
          </div>
          <div class="meta-sec">
            <div class="col-label" style="margin-bottom:8px">Status</div>
            <div class="pill-row">
              <span class="s-pill draft sel">Draft</span>
              <span class="s-pill revised">Revised</span>
              <span class="s-pill final">Final</span>
            </div>
          </div>
          <div class="meta-sec">
            <div class="col-label" style="margin-bottom:8px">Details</div>
            <div class="save-row" style="margin-bottom:7px">POV<span class="wc">Mara</span></div>
            <div class="save-row" style="margin-bottom:7px">Setting<span class="wc">The Shore</span></div>
            <div class="save-row">Edited<span class="wc">2m ago</span></div>
          </div>
        </aside>

      </div>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section class="features" id="features">
  <div class="wrap">

    <!-- FEATURE: STUDIO -->
    <div class="feature">
      <div class="f-text">
        <h3>Where books actually get <span class="yellow">finished</span>.</h3>
        <p>Organize your book into parts, chapters, and collections. Set word goals, track revisions, and keep your whole manuscript in one calm, focused place. When it is ready, export clean EPUB, DOCX, and PDF.</p>
        <div class="f-pills">
          <span class="f-pill">Chapters &amp; parts</span>
          <span class="f-pill">Word goals</span>
          <span class="f-pill">Version history</span>
          <span class="f-pill">Export toolkit</span>
        </div>
      </div>
      <div class="f-mock">
        <div class="mock">
          <div class="mock-rule" style="background:var(--acc-studio)"></div>
          <div class="mock-head">
            <div class="icon-chip" style="background:oklch(0.80 0.14 88/.15)"><svg style="stroke:var(--acc-studio)" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15l-8-4-8 4V5Z"/></svg></div>
            <div><div class="mh-title">Published book</div><div class="mh-sub">studio · manuscript</div></div>
            <span class="chip-status">Live</span>
          </div>
          <div class="mock-body">
            <div class="cover-band"><span class="bk-title">The Gilded Shore</span></div>
            <div class="genre-row">
              <span class="g-pill">Fantasy</span>
              <span class="g-pill">Adventure</span>
              <span class="g-meta">12 chapters · 24k words</span>
            </div>
            <div style="font-size:13px;color:var(--ink-faint);margin-bottom:10px">by Eleanor Voss</div>
            <div class="mrow ch-row"><span class="num">01</span>The Letter<span class="cmt"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11 7L3 21l2-7a8 8 0 1 1 16-2Z"/></svg>4</span></div>
            <div class="mrow ch-row"><span class="num">03</span>The Gilded Shore<span class="mini-draft">Draft</span><span class="cmt"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11 7L3 21l2-7a8 8 0 1 1 16-2Z"/></svg>9</span></div>
            <div class="mrow ch-row"><span class="num">05</span>The Harbor<span class="cmt"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11 7L3 21l2-7a8 8 0 1 1 16-2Z"/></svg>2</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- FEATURE: HIVES -->
    <div class="feature flip">
      <div class="f-text">
        <h3>Never write <span class="yellow">alone</span> again.</h3>
        <p>Spin up a private Hive for your book. Invite co-authors and beta readers, annotate passages, propose rewrites, and submit chapters for approval. Share an outline, a wiki, and a word goal the whole group can rally behind.</p>
        <div class="f-pills">
          <span class="f-pill">Co-authors</span>
          <span class="f-pill">Annotations</span>
          <span class="f-pill">Shared outline</span>
          <span class="f-pill">Approvals</span>
        </div>
      </div>
      <div class="f-mock">
        <div class="mock">
          <div class="mock-rule" style="background:var(--acc-hive)"></div>
          <div class="mock-head">
            <div class="icon-chip" style="background:oklch(0.72 0.11 250/.15)"><svg style="stroke:var(--acc-hive)" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 21v-2a4 4 0 0 0-3-3.87M16 4.13A4 4 0 0 1 16 11.87"/></svg></div>
            <div><div class="mh-title">The Gilded Shore Hive</div><div class="mh-sub">Private · 4 members</div></div>
            <span class="chip-status">Owner</span>
          </div>
          <div class="mock-body">
            <div class="mlabel">Linked book</div>
            <div class="mrow"><span class="type-dot" style="background:var(--acc-hive)"></span><span style="font-size:13.5px;color:var(--ink-muted)">The Gilded Shore</span><span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-faint)">24k words</span></div>
            <div class="tile-grid">
              <div class="htile"><span class="hchip" style="background:oklch(0.72 0.11 250/.15)"><svg style="stroke:var(--acc-hive)" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg></span>Outline</div>
              <div class="htile"><span class="hchip" style="background:oklch(0.72 0.11 250/.15)"><svg style="stroke:var(--acc-hive)" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg></span>Wiki</div>
              <div class="htile"><span class="hchip" style="background:oklch(0.72 0.11 250/.15)"><svg style="stroke:var(--acc-hive)" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg></span>Annotations</div>
              <div class="htile"><span class="hchip" style="background:oklch(0.72 0.11 250/.15)"><svg style="stroke:var(--acc-hive)" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z"/></svg></span>Buzz Board</div>
            </div>
            <div class="mlabel">Activity</div>
            <div class="feed-row"><span class="avatar" style="background:var(--acc-hive)">AV</span><span class="ft"><b>AriaV</b> logged 1,240 words</span><span class="fw">12m</span></div>
            <div class="feed-row"><span class="avatar" style="background:var(--acc-club)">MK</span><span class="ft"><b>MarcK</b> added to the wiki</span><span class="fw">1h</span></div>
            <div class="feed-row"><span class="avatar" style="background:var(--acc-list)">SR</span><span class="ft"><b>SophR</b> left an annotation</span><span class="fw">2h</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- FEATURE: BOOK CLUBS -->
    <div class="feature">
      <div class="f-text">
        <h3>Read in good <span class="yellow">company</span>.</h3>
        <p>Start a club around any book on Beehive Books. Track everyone's progress, discuss chapter by chapter, and keep the best threads pinned so newcomers never lose the plot.</p>
        <div class="f-pills">
          <span class="f-pill">Shared progress</span>
          <span class="f-pill">Chapter threads</span>
          <span class="f-pill">Pinned posts</span>
        </div>
      </div>
      <div class="f-mock">
        <div class="mock">
          <div class="mock-rule" style="background:var(--acc-club)"></div>
          <div class="mock-head">
            <div class="icon-chip" style="background:oklch(0.78 0.13 70/.15)"><svg style="stroke:var(--acc-club)" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2V3ZM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7V3Z"/></svg></div>
            <div><div class="mh-title">Fantasy Readers</div><div class="mh-sub">Book club · 318 members</div></div>
            <span class="chip-status">Active</span>
          </div>
          <div class="mock-body">
            <div class="mlabel">Now reading</div>
            <div class="mrow"><span class="type-dot" style="background:var(--acc-club)"></span><span style="font-size:13.5px;color:var(--ink-muted)">The Gilded Shore</span><span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-faint)">Page 180 / 300</span></div>
            <div class="post">
              <div class="post-head"><span class="avatar" style="background:var(--acc-club)">EV</span><span class="pn">Eleanor Voss</span><span class="pinned"><svg viewBox="0 0 24 24"><path d="M12 17v5M9 10.76V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6.76l2 3.24H7l2-3.24Z"/></svg>Pinned</span></div>
              <p>That reveal in Chapter 3 reframes the whole prologue. Read it again after and tell me you saw it coming.</p>
              <div class="post-foot"><span><svg viewBox="0 0 24 24"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 2 2.45l-1.4 7A2 2 0 0 1 18.5 21H7"/></svg>64</span><span><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11 7L3 21l2-7a8 8 0 1 1 16-2Z"/></svg>28</span></div>
            </div>
            <div class="post">
              <div class="post-head"><span class="avatar" style="background:var(--acc-list)">SR</span><span class="pn">SophR</span></div>
              <p>The tide scene wrecked me. Stopping here for the night, no spoilers past page 200 please.</p>
              <div class="post-foot"><span><svg viewBox="0 0 24 24"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 2 2.45l-1.4 7A2 2 0 0 1 18.5 21H7"/></svg>41</span><span><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11 7L3 21l2-7a8 8 0 1 1 16-2Z"/></svg>12</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- FEATURE: READING LISTS -->
    <div class="feature flip">
      <div class="f-text">
        <h3>Discovery that's actually <span class="yellow">human</span>.</h3>
        <p>Build ranked lists with your own commentary, follow curators whose taste you trust, and surface the next great read before everyone else does. Discovery on Beehive Books is human, not algorithmic.</p>
        <div class="f-pills">
          <span class="f-pill">Ranked lists</span>
          <span class="f-pill">Commentary</span>
          <span class="f-pill">Follow curators</span>
        </div>
      </div>
      <div class="f-mock">
        <div class="mock">
          <div class="mock-rule" style="background:var(--acc-list)"></div>
          <div class="mock-head">
            <div class="icon-chip" style="background:oklch(0.74 0.12 145/.15)"><svg style="stroke:var(--acc-list)" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg></div>
            <div><div class="mh-title">Essential Fantasy Reads</div><div class="mh-sub">by Eleanor Voss · 124 followers</div></div>
            <span class="follow-btn">Follow</span>
          </div>
          <div class="mock-body">
            <div class="rank-row"><span class="rank-num">1<svg viewBox="0 0 24 24"><path d="m5 16-2-9 5.5 4L12 5l3.5 6L21 7l-2 9H5ZM5 20h14"/></svg></span><div><div class="rt">The Gilded Shore</div><div class="ra">Eleanor Voss</div><div class="rc">The rare fantasy that trusts its reader to keep up.</div></div></div>
            <div class="rank-row"><span class="rank-num">2</span><div><div class="rt">Salt &amp; Ash</div><div class="ra">M. Calloway</div><div class="rc">A slow burn that pays off every patient page.</div></div></div>
            <div class="rank-row"><span class="rank-num">3</span><div><div class="rt">The Last Cartographer</div><div class="ra">J. Okafor</div><div class="rc">Worldbuilding you will want to live inside.</div></div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- FEATURE: SPARKS -->
    <div class="feature">
      <div class="f-text">
        <h3>Spark your <span class="yellow">imagination</span>.</h3>
        <p>Sparks are short writing-prompt challenges with a deadline. Drop an entry, vote on your favorites, and watch the community crown a winner.</p>
        <div class="f-pills">
          <span class="f-pill">Prompt challenges</span>
          <span class="f-pill">Community voting</span>
          <span class="f-pill">Creator's choice</span>
        </div>
      </div>
      <div class="f-mock">
        <div class="mock">
          <div class="mock-rule" style="background:var(--acc-spark)"></div>
          <div class="mock-head">
            <div class="icon-chip" style="background:oklch(0.70 0.18 295/.15)"><svg style="stroke:var(--acc-spark)" viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/></svg></div>
            <div><div class="mh-title">Weekly Spark</div><div class="mh-sub">Active challenge</div></div>
            <span class="chip-status">Ends in 3d 14h</span>
          </div>
          <div class="mock-body">
            <div class="prompt-box">
              <div class="pq">"Write the last letter that never got sent."</div>
              <div class="pe">142 entries · 1,908 votes</div>
            </div>
            <div class="entry-row"><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--acc-spark);width:18px">1</span><span class="et">Postmarked Nowhere</span><span class="leading">Leading</span><span class="votes"><svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>312</span></div>
            <div class="entry-row"><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--ink-faint);width:18px">2</span><span class="et">Dear, Eventually</span><span class="votes"><svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>287</span></div>
            <div class="entry-row"><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--ink-faint);width:18px">3</span><span class="et">Return to Sender</span><span class="votes"><svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>241</span></div>
            <a class="btn btn-brand submit-btn" href="${p}/sign-up">Submit Your Entry</a>
          </div>
        </div>
      </div>
    </div>

  </div>
</section>

<!-- PRICING -->
<section class="pricing" id="pricing">
  <div class="wrap">
    <span class="eyebrow">Simple pricing</span>
    <h2>Start free. Upgrade when you're ready.</h2>
    <div class="price-grid">
      <div class="price-card">
        <div class="tier-name">Free</div>
        <div class="tier-price">$0<span> / forever</span></div>
        <ul class="tier-feats">
          <li>${check} Up to 3 books</li>
          <li>${check} Full Studio editor</li>
          <li>${check} Hives and community</li>
          <li>${check} Publish to readers</li>
        </ul>
        <a class="btn btn-ghost" href="${p}/sign-up">Start free</a>
      </div>
      <div class="price-card premium">
        <span class="most-pop">Most popular</span>
        <div class="tier-name">Premium</div>
        <div class="tier-price">$8<span> / month</span></div>
        <ul class="tier-feats">
          <li>${check} Unlimited books and Hives</li>
          <li>${check} Full version history</li>
          <li>${check} Publishing and export toolkit</li>
          <li>${check} Import from DOCX, PDF, EPUB</li>
        </ul>
        <a class="btn btn-brand" href="${p}/pricing">See full pricing</a>
      </div>
    </div>
  </div>
</section>

<!-- CLOSING CTA -->
<section class="closing">
  <div class="wrap">
    <h2>Ready to find your hive?</h2>
    <p>Join the writers drafting, sharing, and finishing their books on Beehive Books.</p>
    <a class="btn btn-brand" href="${p}/sign-up">Start Writing Free</a>
  </div>
</section>

<!-- FOOTER -->
<footer class="footer">
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        <a class="brand-mark" href="${p}">
          ${hex}
          <span>Beehive Books</span>
        </a>
        <div class="slogan">Get buzzed about writing!</div>
        <div class="social">
          <a href="https://x.com" aria-label="X"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg></a>
          <a href="https://github.com" aria-label="GitHub"><svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.523 2 12 2Z"/></svg></a>
        </div>
      </div>
      <div class="fcol">
        <h4>Product</h4>
        <a href="#features">Studio</a>
        <a href="#features">Hives</a>
        <a href="#features">Sparks</a>
        <a href="${p}/discover">Discover</a>
      </div>
      <div class="fcol">
        <h4>Community</h4>
        <a href="#features">Reading lists</a>
        <a href="#features">Book clubs</a>
        <a href="${p}/community">Community</a>
      </div>
      <div class="fcol">
        <h4>Company</h4>
        <a href="${p}/pricing">Pricing</a>
        <a href="${p}/privacy">Privacy</a>
        <a href="${p}/terms">Terms</a>
        <a href="${p}/dmca">DMCA</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 Beehive Books</span>
      <span>Get buzzed about writing!</span>
    </div>
  </div>
</footer>
`
}

export function MarketingLanding({ locale }: { locale: string }) {
  return <div className="bb-landing" dangerouslySetInnerHTML={{ __html: landingHtml(locale) }} />
}
