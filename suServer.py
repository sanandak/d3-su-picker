#!/usr/bin/env python

# websocket server for su data
# returns a json string

import sys

# FIXME - this only works with 3.5, not 3.6
if sys.version_info == (3, 6):
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

def getTrc(t, headonly=True, decimate=False, t1=-1, t2=-1, flo=None, fhi=None):
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
    t1, t2 : number
        If `t1` and `t2` are specified > 0, window the data and return only those

    Returns:
    --------
    dict
        Dictionary with keys `tracl`, `tracr`, `ffid`, `offset`, and `samps` 
        (at a minimum; see the code for the full list)

    """
    dt = t.header.sample_interval_in_ms_for_this_trace/(1000.*1000.)
    ns = t.header.number_of_samples_in_this_trace
    samps = []

    ampscale = 1
    if not headonly:
        # because I used headonly in the original open,
        # the data are read anew from file every time data is
        # referenced (check this)
        d = t.data # read from file?
        print('in gettrc', decimate)
        if decimate:
            print('decimate', decimate, dt)
            try:
                d = sig.decimate(d, q=10, zero_phase=True)
                dt = dt*10
            except:
                print('decimate failed')
                return
            
        if t1 > 0 and t2 > 0:
            i1 = int(t1/dt)
            i2 = int(t2/dt)
            d = d[i1:i2]
            tarr=np.arange(i1*dt,(i2+1)*dt,dt)
            print(i1,i2, dt,len(d), len(tarr))

        else:
            tarr=np.arange(0,ns*dt,dt)

        max = np.max(d)
        min = np.min(d)
        ampscale = (max-min)
        if ampscale != 0:
            d /= (max-min)

        #print("amp", ampscale, max, min)

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
           "ampscale" : "{}".format(ampscale),
           "ns": len(samps),
           "dt": dt,
           "samps": samps}
    return trc

def handleMsg(msgJ):
    """Process the message in msgJ.

    Parameters:
    msgJ: dict
        Dictionary with command sent from client

    Returns:
    string
        JSON string with command response

    Commands are of the form:
    {'cmd' : 'getCCC', 'param0': 'param0val', ...}

    Response is a string of the form (note that JSON is picky that keys
    and strings should be enclosed in double quotes:
    '{"cmd" : "getCmd", "cmd" : "<response>"}'

    {'cmd':'getHello'} -> {"cmd":"getHello", "hello": "world"}

    {'cmd':'getSegyHdrs', filename: f} -> 
        {"cmd":"getSegyHdrs", "segyhdrs": 
                              {ns:ns, dt:dt: hdrs:[hdr1, hdr2...]}}

    FIXME FIXME - this currently returns "segy", not "ensemble" as the key
    WARNING - you must call getSegyHdrs first
    flo and fhi are optional.  If they are not present, no filtering
    {'cmd':'getEnsemble', filename:f, ensemble:n, [flo:flo, fhi: fhi]} -> 
        {"cmd":"getEnsemble", "segy":
                              {ns:ns, dt:dt: traces:[trc1, trc2...]}}
    """
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

        decimate = False
        try:
            ens = int(msgJ['ensemble'])
            try:
                decimate = msgJ['decimate']
                print('dec t', decimate)
            except:
                decimate=False
                print('dec f', decimate)
            
            try:
                t1 = float(msgJ['t1'])
                t2 = float(msgJ['t2'])
            except:
                t1=-1
                t2=-1
            try:
                flo = float(msgJ['flo'])
                fhi = float(msgJ['fhi'])
                print(flo, fhi)
                traces = [getTrc(t,headonly=False, decimate=decimate, t1=t1, t2=t2, flo=flo, fhi=fhi) for t in segy.segyfile.traces if t.header.original_field_record_number == ens]
            except:
                print('err filt')
                traces = [getTrc(t,headonly=False,decimate=decimate, t1=t1,t2=t2) for t in segy.segyfile.traces if t.header.original_field_record_number == ens]
        except:
            print('err ens', ens, decimate)
            ret = json.dumps({"cmd":"getEnsemble", "error": "Error reading ensemble number"})
            return ret
        print("ens = {} ntrc={}".format(ens, len(traces)))
        # dt/ns could change from the original due to decimation
        dt = traces[0]["dt"]
        ns = traces[0]["ns"]
        print('dt, ns', dt, ns)
        #print(json.dumps(traces[0]))
        ret = json.dumps({"cmd": "segy",
                          "segy" : json.dumps({"dt":dt, "ns":ns, "traces":traces})})
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
# all this is stolen from the websockets tutorial. 
@asyncio.coroutine
def api(ws, path):
    while True:
        try:
#            msg = await ws.recv()
            # get a websockets string
            msg = yield from ws.recv()
            print('msg', msg)
            try:
                msgJ = json.loads(msg)
            except json.decoder.JSONDecodeError:
                print("error decoding msg >{}<".format(msg))
                continue

            print("got json msgJ >{}<".format(msgJ))
            # and handle it...
            retJ = handleMsg(msgJ)

            #print(retJ)
            # and return the response to the client
            yield from ws.send(retJ)
            #            await ws.send(retJ)

        except websockets.ConnectionClosed:
            print('connection closed')
            return

ss = websockets.serve(api, 'localhost', 9191)
# all this is stolen from the websockets tutorial.
try:
    print("ready...")
    sys.stdout.flush()
    asyncio.get_event_loop().run_until_complete(ss)
    asyncio.get_event_loop().run_forever()
except KeyboardInterrupt:
    print("bye")
    
