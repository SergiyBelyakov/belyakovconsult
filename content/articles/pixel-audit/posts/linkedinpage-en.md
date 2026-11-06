---
publish_at: 2026-11-06 15:30   # піксель-арт фан-тригер «Check before you delete», найближчий кращий слот (next_slot.py)
link: false
media: motion
video: en/pixel-9x16.mp4
max_late_hours: 72
---
A small pixel-art reminder for anyone running a data cleanup this quarter.

Removing NULL, TEST and duplicate records feels like progress, and the counter goes up fast. The risk is a cleanup rule that runs faster than the checking: a real record that looks unusual gets deleted along with the junk.

A simple control before any bulk delete: sample ten records from the "delete" list and review each one manually. If even one turns out to be real, the rule needs adjusting before it runs on the full dataset.

Clean data is not less data. It is data someone checked.

Has a cleanup ever removed something it should not have?

#DataQuality #DataGovernance #MasterData
