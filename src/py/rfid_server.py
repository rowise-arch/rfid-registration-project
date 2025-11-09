import asyncio
import websockets
from smartcard.System import readers

async def send_uid(websocket):
    while True:
        try:
            r = readers()
            if len(r) == 0:
                await websocket.send("No reader found")
                await asyncio.sleep(2)
                continue

            reader = r[0]
            connection = reader.createConnection()
            
            try:
                connection.connect()
                
                get_uid = [0xFF, 0xCA, 0x00, 0x00, 0x00]
                data, sw1, sw2 = connection.transmit(get_uid)
                if sw1 == 0x90 and sw2 == 0x00:
                    # Convert bytes to decimal string (same as Arduino)
                    decimal_uid = ''.join(str(byte) for byte in data)
                    await websocket.send(decimal_uid)
                else:
                    await websocket.send("Error reading card")
                    
            except Exception as e:
                # Card was removed or communication error
                await websocket.send("Waiting for card...")
                
        except Exception as e:
            await websocket.send(f"Reader error: {e}")
            
        await asyncio.sleep(1)

async def main():
    async with websockets.serve(send_uid, "localhost", 8765):
        print("✅ RFID WebSocket server running at ws://localhost:8765")
        await asyncio.Future()  # run forever

asyncio.run(main())