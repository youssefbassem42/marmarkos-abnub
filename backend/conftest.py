"""Root-level pytest configuration.

This file is loaded by pytest **before** ``tests/conftest.py`` (pytest walks
the rootdir down to the test directories), which makes it the right place to
sanitize the environment: the application's settings module reads the
``.env`` file from the working directory, and that file may hold real
production credentials.

Importing :mod:`tests.env_bootstrap` here blanks every third-party
credential and refuses to continue unless the configured database is
explicitly a test database - before any application module is imported.
"""

from tests import env_bootstrap  # noqa: F401  (side-effect import: sanitizes os.environ)
