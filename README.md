# GAME ROOM

**Hard questions. Real games. One room.**

Game Room is a small, hand-made arcade for people who like knowing how things actually work.
It has real-time games about biology, quiz packs that explain every answer, and a party mode
where a teacher runs the night on the projector while the whole class plays on their phones.

It opens in a browser with nothing to install, and you don't need an account to play.

---

## What's inside

### The Game Room (free, solo)
Click a tile and play. The games are real games that happen to teach something, not quizzes dressed up.

| Game | What you do | What it is really about |
|---|---|---|
| **Moth Hunter** | You are the bird. Eat the moths you can spot. | Natural selection: watch the population's color shift in front of you |
| **Antibody Arena** | Match the antibody to each incoming virus and let your best clones grow | Antibody specificity and clonal selection |
| **Replicator** | You are DNA polymerase. Copy the strand before the cell falls apart | Base pairing and replication under pressure |
| **Cell Cycle Runner** | Run G1, S, G2, M. Repair damage or gamble at the checkpoints | Checkpoints, and why skipping them is how cancer starts |

### The Quiz Shelf (free, solo)
Deep packs, written to make you think rather than to recall. Every question shows *why* after you answer,
and you get a review of everything you missed at the end of each round.

| Pack | Rounds |
|---|---|
| **AP Biology: Deep Cuts** | Enzymes and energy · Gene regulation and biotech · Inheritance and evolution · Systems and ecology |
| **AP Biology: Fun Day** | The original party rounds, with a Meselson-Stahl boss |
| **AP Statistics** | Exploring data · Collecting data · Probability · Inference |
| **Bioinformatics** | Sequences · Alignment and BLAST · Genomes and RNA-seq · Trees, structure, databases |
| **Comparative Religion** | Texts and canons · Big ideas compared · Practice and calendar · History and branches |

Faster right answers score more, streaks add a bonus, and the last question of a round is a **boss** worth double.

**Bring your own quiz.** Upload any quiz as JSON or CSV (a spreadsheet works: save it as CSV).
It stays on your shelf and can go straight into a party. Templates are on the Upload window, and the format is in [`quizzes/FORMAT.md`](quizzes/FORMAT.md).

### Party mode (for teachers)
A whole class session on one projector, built from blocks you choose:

- **Spawn.** Everyone picks a name and a blocky guy and walks around the big screen.
- **Quiz rounds.** Any round from the shelf, or your own. At the reveal, every guy walks to the answer they picked.
- **Cell Defense.** A co-op immune-system arcade where the class has to talk to win.
- **Ping Pong.** A knockout tournament with mind games.
- **Food Web.** Three teams run one ecosystem.
- **Cell Cycle Dash.** A race through the cell cycle.
- **Break room.** A timer, a jukebox where everyone gets a fair turn to pick a song, and chat.
- **Movie night.** The class votes on the film, and live comments and a hype meter go on the projector.
- **Awards.** Automatic awards plus personal shoutouts you write yourself.

Students join on their phones with a 4-letter code. They don't need an app or an account.

---

## Get it for your class

Hosting a party needs a **teacher code**. A code is a one-time purchase that gives you **lifetime access**, with no subscription.
One code works on every device you teach from. You type it once and that browser remembers it.

**Want to try first?** In Party mode, click **Try the demo**. You get the full party, running in your own browser,
so you can open the projector and a few "phones" as tabs and click through a whole night.

To get a code, use the donate/contact link at the bottom of the site, or reach us through [zeffiroh.github.io](https://zeffiroh.github.io).

The solo games and the Quiz Shelf are free for everyone, forever.

---

## Who made this

Game Room is made by **Mitali Aayat Mahnoor**: [zeffiroh.github.io](https://zeffiroh.github.io).
It started as a party for one AP Bio class and grew from there.

If it made your class better, there's a small ♥ **Donate** button at the bottom of every page.

---

## Run your own copy
It is a static site: put the folder on GitHub Pages (keep `.nojekyll`), and settings live in `config.js`.
The database setup is in `db/`.
