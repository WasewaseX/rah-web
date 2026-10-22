#!/usr/bin/env python3
"""Print one key from a JSON file - bracket-safe id extraction for batteries.
Usage: iso-id.py <file> <key>"""
import json, sys
print(json.load(open(sys.argv[1]))[sys.argv[2]])
