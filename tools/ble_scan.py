"""Scan for nearby BLE devices and dump the GATT table of anything that looks like a probe.

Usage: .venv/bin/python -I tools/ble_scan.py [seconds]     (probes powered on, near the laptop)
Writes research/ble-scan-<timestamp>.json so the protocol work has raw data to start from.
"""
import asyncio, json, sys, time
from pathlib import Path
from bleak import BleakScanner, BleakClient

OUT = Path(__file__).resolve().parent.parent / "research"

async def main(secs):
    found = await BleakScanner.discover(timeout=secs, return_adv=True)
    rows = []
    for addr, (dev, adv) in found.items():
        rows.append({"addr": addr, "name": adv.local_name or dev.name, "rssi": adv.rssi,
                     "services": adv.service_uuids,
                     "mfr": {str(k): v.hex() for k, v in adv.manufacturer_data.items()}})
    rows.sort(key=lambda r: -r["rssi"])
    for r in rows:
        print(f'{r["rssi"]:>4}  {r["addr"]}  {r["name"]!s:<24} {r["services"]} {r["mfr"]}')
    # Dump GATT for named devices that aren't obviously phones/headphones.
    for r in rows:
        if not r["name"]:
            continue
        try:
            async with BleakClient(r["addr"], timeout=10) as c:
                r["gatt"] = [{"service": s.uuid, "chars": [{"uuid": ch.uuid, "props": ch.properties} for ch in s.characteristics]}
                             for s in c.services]
        except Exception as e:
            r["gatt_error"] = str(e)
    path = OUT / f"ble-scan-{time.strftime('%Y%m%d-%H%M%S')}.json"
    path.write_text(json.dumps(rows, indent=1))
    print("wrote", path)

asyncio.run(main(float(sys.argv[1]) if len(sys.argv) > 1 else 15))
