#!/usr/bin/env python3
"""Download the OSM ways needed by a lightweight 3D scene."""

import argparse
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import ProxyHandler, Request, build_opener


parser = argparse.ArgumentParser()
parser.add_argument("output")
parser.add_argument("--bbox", required=True, help="south,west,north,east")
parser.add_argument("--timeout", type=int, default=120)
args = parser.parse_args()

query = f'''[out:xml][timeout:{args.timeout - 20}];
(
  way["highway"]({args.bbox});
  way["building"]({args.bbox});
  way["natural"="water"]({args.bbox});
  way["water"]({args.bbox});
  node["name"]({args.bbox});
  way["name"]({args.bbox});
);
(._;>;);
out body;'''

opener = build_opener(ProxyHandler({}))
endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]
last_error = None
for endpoint in endpoints:
    try:
        request = Request(
            endpoint,
            data=urlencode({"data": query}).encode(),
            headers={"User-Agent": "BeijingPark3DPrototype/1.0"},
        )
        with opener.open(request, timeout=args.timeout) as response:
            payload = response.read()
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_bytes(payload)
        print(f"Downloaded {len(payload):,} bytes from {endpoint}")
        break
    except (HTTPError, URLError, TimeoutError) as error:
        last_error = error
else:
    raise SystemExit(f"OSM download failed: {last_error}")
