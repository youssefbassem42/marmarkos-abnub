# The design references

The screens of the platform, as they were designed. They are **reference
material**, not part of the application: nothing in `frontend/` imports
them and nothing in `backend/` serves them.

## Why they are WebP

The folder used to hold 52 MB of PNG (44 files, 1.4 MB each). A clone
of the repository paid for them on every checkout, and the diff of a
new design was a binary blob nobody could read.

The images are now WebP (quality 86) - **4.5 MB for the same 44
screens**, and they look the same. The originals were PNG/JPEG exports
of the design tool; the WebP files are generated from them once
(2026-10-27) and are the reference from now on.

## How to add a new design

1. Export the screen from the design tool as PNG.
2. Convert it:

   ```bash
   python -m pip install pillow
   python -c "from PIL import Image; im = Image.open('screen.png'); im.save('screen.webp', 'WEBP', quality=86, method=6)"
   ```

3. Delete the PNG and commit the WebP.

Keep the name of the screen in the file name (`<Screen>-<lang>.webp`,
the language is `ar` or `en`).

## The history

The 52 MB of PNG are still in the history of the repository (a clone
with a full history still downloads them once). Removing them from the
history means rewriting it - a dangerous operation that has to be done
by everybody at the same time. It is deliberately **not** part of this
remediation; the decision belongs to the team.
