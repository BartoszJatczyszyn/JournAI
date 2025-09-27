#!/usr/bin/env python3
"""
Minimal Enhanced Flask API bootstrap.

- Loads environment from config.env
- Creates Flask app and enables CORS
- Registers modular blueprints (analytics, predictions, insights, activities, sleeps)

All route implementations live in the blueprints packages to follow SOLID.
"""
from __future__ import annotations

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

# Load environment variables from project config
load_dotenv("config.env")

# Create Flask app
app = Flask(__name__)
CORS(app)

# Register blueprints (modular routing)
from blueprints import register_blueprints  # noqa: E402  (import after app creation)
register_blueprints(app)


__all__ = ["app"]


if __name__ == "__main__":  # pragma: no cover
    # Default dev server
    app.run(debug=True, host="0.0.0.0", port=5002)
