"""Isolated API fixture for browser integration tests. Start only on loopback."""

import os
import mongomock
from backend.main import app, db

database = mongomock.MongoClient(tz_aware=True).browser_tests
app.dependency_overrides[db] = lambda: database
os.environ["COOKIE_SECURE"] = "0"
