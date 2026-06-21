# Office Window styling smoke check

After changes that touch global layout, capture UI, or route-level components, manually check these local routes before merging:

- `/` keeps the dark Office Window cockpit shell, sidebar, metrics, queue cards, and markdown cards.
- `/queues` keeps card/table styling and shows integrated row `Record` capture buttons when queue rows exist.
- `/capture` keeps the same shell and shows styled lifecycle cards, event cards, audio players, and capture metadata.

Useful local command:

```bash
OFFICE_ARTIFACTS_ROOT=/home/matias/repos/office-auto-lab/artifacts \
OFFICE_FEEDBACK_INBOX=/home/matias/repos/office-auto-lab/inbox/human_feedback \
OFFICE_FEEDBACK_AUDIO_ROOT=/home/matias/repos/office-auto-lab/inbox/human_feedback_audio \
npm run dev -- -p 3310 -H 127.0.0.1
```
