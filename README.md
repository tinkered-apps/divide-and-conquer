# Divide & Conquer

A spaced-repetition trainer for times tables and division, for primary-school children. Live at
<https://divideconquer.tinkered.app>. English by default, Polish behind the flag toggle.

## How it schedules practice

Every fact (`7 × 8`, `56 ÷ 7`, `7 × _ = 56`) has its own mastery stage and due date.

- A wrong answer brings the fact back after two other questions.
- A first correct answer brings it back after three questions.
- Further correct answers space reviews out to 1, 3, 7 and 14 days, then every 30 days.
- `7 × 8` and `8 × 7` share one record, so there are 55 multiplication facts, not 100.
- Sessions mix due facts with unseen ones and last 1, 2, 3, 5 or 10 minutes.

## Activities

| Activity | What it drills |
| --- | --- |
| Multiplication | Times tables up to 100 |
| Division | `1 ÷ 1` to `100 ÷ 10` |
| Missing factor | `7 × _ = 49` |
| Learn / review: multiplication | Quiz out loud with a parent or self-check, marking each fact *knows* or *needs practice* |
| Learn / review: division | The same, for division |
| Progress | A grid of every fact: remembered, learning, review due, not practised |

## Data

There are no accounts, no server-side storage, no analytics and no third-party requests. Learners,
answers and settings live in the browser's `localStorage` and never leave the device. The
[privacy note](https://divideconquer.tinkered.app/privacy) ([source](public/privacy.html)) lists what
the app stores and what the host and the author's email see.

- **Save backup** downloads a JSON file with every learner on the device. **Restore backup** loads it
  on another device or after browser data was cleared.
- **Delete learner** removes that learner from the device.
- Safari on iPhone and iPad deletes site data after about seven days without a visit. Adding the app
  to the Home Screen prevents that, and the installed app also works offline.

## Development

The site is a Cloudflare Worker with static assets only. Restoring it means redeploying a known-good
commit; there is no server-side data to restore. Commands and conventions are in [AGENTS.md](AGENTS.md).

## Credits

- Author: Kuba (kuba@tinkered.app)
- Fonts: Bricolage Grotesque and Figtree, SIL Open Font License 1.1, licence texts in
  [public/fonts/](public/fonts)
