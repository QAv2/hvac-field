"""Connect to one BLE device, subscribe to every notify/indicate characteristic, log raw bytes.

Usage: .venv/bin/python -I tools/ble_capture.py <ADDR> [label]
While it runs, type a note + Enter (e.g. "0 psi", "ice bath 32F", "clamp on hand") to drop a
marker into the log, so readings can be matched to known conditions. Ctrl-C to stop.
Also reads every readable characteristic once (names, firmware, calibration blobs).
Log: research/captures/<label>-<timestamp>.jsonl
"""
import asyncio, json, sys, time
from pathlib import Path
from bleak import BleakClient

addr = sys.argv[1]
label = sys.argv[2] if len(sys.argv) > 2 else addr.replace(":", "")
out = Path(__file__).resolve().parent.parent / "research" / "captures"
out.mkdir(parents=True, exist_ok=True)
path = out / f"{label}-{time.strftime('%Y%m%d-%H%M%S')}.jsonl"
log = path.open("a")

def write(kind, **kw):
    rec = {"t": round(time.time(), 3), "kind": kind, **kw}
    log.write(json.dumps(rec) + "\n"); log.flush()
    return rec

async def notes():
    loop = asyncio.get_running_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            return
        write("mark", note=line.strip()); print(f"--- mark: {line.strip()}")

async def main():
    async with BleakClient(addr, timeout=20) as c:
        print("connected", addr, "->", path)
        for s in c.services:
            for ch in s.characteristics:
                write("char", service=s.uuid, uuid=ch.uuid, props=ch.properties)
                if "read" in ch.properties:
                    try:
                        v = await c.read_gatt_char(ch)
                        write("read", uuid=ch.uuid, hex=v.hex(), text=v.decode("utf-8", "replace"))
                        print("read ", ch.uuid, v.hex(), repr(v[:32]))
                    except Exception as e:
                        write("read_err", uuid=ch.uuid, err=str(e))
                if {"notify", "indicate"} & set(ch.properties):
                    def cb(sender, data, u=ch.uuid):
                        write("notify", uuid=u, hex=data.hex())
                        print(f"{time.strftime('%H:%M:%S')} {u[4:8]} {data.hex()}")
                    await c.start_notify(ch, cb)
                    print("subscribed", ch.uuid)
        await notes()

try:
    asyncio.run(main())
except KeyboardInterrupt:
    pass
print("log:", path)
