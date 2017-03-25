#!/usr/bin/env python

# websocket server for gp5 data
# json 

import sys

if sys.version_info < (3, 4):
    raise "** must use python v3.4 or later"

import asyncio
import websockets
from datetime import datetime, timedelta
from numpy import random
import numpy as np
import scipy.signal as sig
import json
import pprint

#print("loading obspy...")
from obspy.io.segy.segy import _read_su
#print("... done.")

def getTrc(t):
    dt = t.header.sample_interval_in_ms_for_this_trace/(1000.*1000.)
    ns = t.header.number_of_samples_in_this_trace
    tarr=np.arange(0,(ns-1)*dt,dt)
    # .tolist needed so that json can serialize it
    varr = t.data.tolist()
    # create the samps array
    samps = [{'t':t,'v':v} for (t,v) in zip(tarr,varr)]
    trc = {"tracl": t.header.trace_sequence_number_within_line,
           "tracr": t.header.trace_sequence_number_within_segy_file,
           "ffid": t.header.original_field_record_number,
           "offset": t.header.distance_from_center_of_the_source_point_to_the_center_of_the_receiver_group,
           "samps": samps}
    return trc

def handleMsg(msgJ):
    print('msgJ: {}'.format(msgJ))
    if msgJ['cmd'].lower() == 'getsegy':
        print('getting segy', msgJ)
        filename = msgJ['filename']
        print(filename)

        t0 =datetime.now()
        try:
            s = _read_su(filename)
        except:
            ret = json.dumps({"cmd":"readSegy", "error": "Error reading file {}".format(filename)})
            return ret
        
        print("ntrcs = {}".format(len(s.traces)))
        
        # read trace headers
        t1=datetime.now()

        traces = [getTrc(t) for t in s.traces]
        ns = s.traces[0].header.number_of_samples_in_this_trace
        dt = s.traces[0].header.sample_interval_in_ms_for_this_trace/(1000.*1000.)

        t2=datetime.now()

        #print(traces)
        #print(json.dumps(traces[0]['samps'].tolist()))
        print((t1-t0).total_seconds())
        print((t2-t1).total_seconds())

        ret = json.dumps({"cmd": "segy",
                          "segy" : json.dumps({"dt":dt, "ns":ns, "traces":traces})})
        
    if msgJ["cmd"].lower() == "gethello":
        ret = json.dumps({"cmd": "hello", "hello": "world"})

    return ret

#async def api(ws, path):
@asyncio.coroutine
def api(ws, path):
    while True:
        try:
#            msg = await ws.recv()
            msg = yield from ws.recv()
            print('msg', msg)
            try:
                msgJ = json.loads(msg)
            except json.decoder.JSONDecodeError:
                print("error decoding msg >{}<".format(msg))
                continue

            print("got json msgJ >{}<".format(msgJ))
            retJ = handleMsg(msgJ)

            #print(retJ)
            yield from ws.send(retJ)
            #            await ws.send(retJ)

            
            #now = datetime.datetime.utcnow().isoformat() + 'Z'
            #await ws.send(now)
            #await asyncio.sleep(random.random() * 3)
        except websockets.ConnectionClosed:
            print('connection closed')
            return

ss = websockets.serve(api, 'localhost', 9191)
try:
    print("ready...")
    sys.stdout.flush()
    asyncio.get_event_loop().run_until_complete(ss)
    asyncio.get_event_loop().run_forever()
except KeyboardInterrupt:
    print("bye")
    
