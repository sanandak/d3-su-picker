#!/usr/bin/env python

# websocket server for su data
# returns a json string

import sys

# FIXME - this only works with 3.5, not 3.6
if sys.version_info < (3, 4) or sys.version_info > (3, 5):
    raise "** must use python v3.4 or 3.5"

import asyncio
import websockets
from datetime import datetime, timedelta
import numpy as np
import scipy.signal as sig
import json
import pprint

#print("loading obspy...")
from obspy.io.segy.segy import _read_su
#print("... done.")

class Segy(object):
    def __init__(self):
        self.filename = None
        self.hdrs = None
        self.traces = None
        self.ns = 0
        self.dt = 0
        self.segyfile = None

    def getPSD(self, ens):
        """ Calculate and return average power spectral density for ensemble 
        `ens` using Welch's method
        """
        print('in getpsd, ens=', ens, self)
        if not self.segyfile:
            raise Exception("File not opened")
        enstrcs = [t for t in self.segyfile.traces if t.header.original_field_record_number == ens]
        psds = [sig.welch(t.data, fs=1/self.dt, scaling='spectrum') for t in enstrcs]
        # psds is [(f,psd), (f,psd)...]
        freqs = psds[0][0]
        psdonly = [p for (f,p) in psds]
        psdonly = np.array(psdonly).transpose()
        psdavg = np.mean(psdonly,1)
        print(freqs.shape, psdavg.shape)
        return(freqs, psdavg)

segy = Segy()
print(segy)

def getTrc(t, headonly=True, flo=None, fhi=None):
    """Convert a segy trace to a python dict

    An obspy SegyTrace t is converted to a python dict with optional
    filtering of the data.

    Parameters:
    -----------
    t : SegyTrc object
    headonly : bool, optional 
         If True, only return the trace headers, with `samps` set to an 
         empty array.
    flo, fhi : number
        If `flo` and `fhi` are specified, filter the data before return.

    Returns:
    --------
    dict
        Dictionary with keys `tracl`, `tracr`, `ffid`, `offset`, and `samps` 
        (at a minimum; see the code for the full list)

    """
    dt = t.header.sample_interval_in_ms_for_this_trace/(1000.*1000.)
    ns = t.header.number_of_samples_in_this_trace
    samps = []


    if not headonly:
        tarr=np.arange(0,ns*dt,dt)
        # because I used headonly in the original open,
        # the data are read anew from file every time data is
        # referenced (check this)
        d = t.data # read from file?

        # if a filter is requested...
        if flo and fhi:
            fnyq = 0.5/dt
            #print(flo, fhi, fnyq)
            if flo>fnyq or fhi>fnyq:
                raise Exception('invalid frequencies')
            b,a = sig.butter(8,[flo/fnyq, fhi/fnyq], 'bandpass')
            # print(flo, fhi, fnyq, b, a)

            y = sig.filtfilt(b, a, d)
            # .tolist needed so that json can serialize it (it can't hand numpy arrays)
            varr = y.tolist()
        else:         # otherwise use raw data
            varr = d.tolist()

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
    if msgJ['cmd'].lower() == 'getsegyhdrs':
        print('getting segyhdr', msgJ)
        filename = msgJ['filename']
        print(filename)

        t0 =datetime.now()
        if segy.filename != filename:
            # new file - open it
            try:
                s = _read_su(filename, headonly=True)
                segy.filename = filename
                segy.segyfile = s
            except:
                ret = json.dumps({"cmd":"readSegy", "error": "Error reading file {}".format(filename)})
                return ret
            print("ntrcs = {}".format(len(segy.segyfile.traces)))

        hdrs = [getTrc(t, headonly=True) for t in segy.segyfile.traces]
        ns = segy.segyfile.traces[0].header.number_of_samples_in_this_trace
        dt = segy.segyfile.traces[0].header.sample_interval_in_ms_for_this_trace/(1000.*1000.)
        segy.ns = ns
        segy.dt = dt
        segy.hdrs = hdrs

        ret = json.dumps({"cmd": "readSegyHdrs",
                          "segy" : json.dumps({"dt":dt, "ns":ns, "hdrs":hdrs})})
        return ret

    if msgJ['cmd'].lower() == 'getensemble':
        print('getting ens', msgJ)
        if segy.segyfile is None:
            ret = json.dumps({"cmd":"getEnsemble", "error": "Error reading ensemble"})
            return ret

        try:
            ens = int(msgJ['ensemble'])
            try:
                flo = float(msgJ['flo'])
                fhi = float(msgJ['fhi'])
                print(flo, fhi)
                traces = [getTrc(t,headonly=False,flo=flo, fhi=fhi) for t in segy.segyfile.traces if t.header.original_field_record_number == ens]
            except:
                print('err filt')
                traces = [getTrc(t,headonly=False) for t in segy.segyfile.traces if t.header.original_field_record_number == ens]
        except:
            print('err ens')
            ret = json.dumps({"cmd":"getEnsemble", "error": "Error reading ensemble number"})
            return ret
        print("ens = {} ntrc={}".format(ens, len(traces)))
        ret = json.dumps({"cmd": "segy",
                          "segy" : json.dumps({"dt":segy.dt, "ns":segy.ns, "traces":traces})})
        return ret

    if msgJ["cmd"].lower() == "getpsd":
        if segy.segyfile is None:
            ret = json.dumps({"cmd":"getpsd",
                              "error": "Error reading ensemble"})
            return ret
        try:
            ens = int(msgJ['ensemble'])
            print(ens)
            (f,psd) = segy.getPSD(ens)
        except:
            print('err ens/psd')
            ret = json.dumps({"cmd":"getPSD",
                              "error": "Error reading ensemble number"})
            return ret

        return json.dumps({"cmd":"getPSD", "ensemble":ens, "freqs":f.tolist(), "psd":psd.tolist()})
    
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
    
